import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PrismaClient,
  approveEmailJob,
  cancelBillingCycleReminders,
  cancelSubscriptionReminders,
  claimEmailJobs,
  claimScheduledEvents,
  confirmSubscriptionRenewal,
  createConsoleEmailTransport,
  processEmailJob,
  processScheduledEvent,
  recoverExpiredLeases,
  renderTemplate,
  resetConsoleEmailIdempotency,
  scheduleMaintenanceDueReminders,
  scheduleOverduePaymentDrafts,
  scheduleSubscriptionRemindersFor,
} from "../src/index.js";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
loadEnv({ path: rootEnv });

const prisma = new PrismaClient();
const suffix = `j${Date.now()}`;

describe("template rendering", () => {
  it("replaces mustache-style variables", () => {
    expect(
      renderTemplate("Hello {{name}} — {{amount}}", {
        name: "Ada",
        amount: "10.00",
      }),
    ).toBe("Hello Ada — 10.00");
  });
});

describe("Phase 7 jobs & email", () => {
  let adminId: string;
  let subscriptionId: string;
  let cycleId: string;
  let agreementId: string;

  beforeAll(async () => {
    await prisma.currency.upsert({
      where: { code: "ETB" },
      update: { isReporting: true, isActive: true },
      create: {
        code: "ETB",
        name: "Ethiopian Birr",
        symbol: "Br",
        isReporting: true,
      },
    });

    await prisma.expenseCategory.upsert({
      where: { slug: "subscription_renewal" },
      update: { isSystem: true },
      create: {
        slug: "subscription_renewal",
        name: "Subscription Renewal",
        isSystem: true,
      },
    });

    for (const template of [
      {
        key: "subscription_reminder",
        subject: "Sub {{subscription_name}}",
        bodyHtml: "<p>{{subscription_name}} {{expiration_date}}</p>",
        bodyText: "{{subscription_name}} {{expiration_date}}",
      },
      {
        key: "maintenance_due_reminder",
        subject: "Due {{project_name}}",
        bodyHtml: "<p>{{outstanding}} {{payment_instructions}}</p>",
        bodyText: "{{outstanding}}",
      },
      {
        key: "overdue_payment",
        subject: "Overdue {{project_name}}",
        bodyHtml: "<p>{{outstanding}}</p>",
        bodyText: "{{outstanding}}",
      },
    ]) {
      await prisma.emailTemplate.upsert({
        where: { key: template.key },
        update: template,
        create: template,
      });
    }

    await prisma.setting.upsert({
      where: { key: "payment_instructions" },
      update: { value: "Pay via bank transfer." },
      create: {
        key: "payment_instructions",
        value: "Pay via bank transfer.",
      },
    });
    await prisma.setting.upsert({
      where: { key: "subscription_reminder_after_expiration_days" },
      update: { value: [-1] },
      create: {
        key: "subscription_reminder_after_expiration_days",
        value: [-1],
      },
    });

    const admin = await prisma.user.upsert({
      where: { email: `jobs-admin-${suffix}@example.com` },
      update: { role: "ADMIN", isActive: true },
      create: {
        email: `jobs-admin-${suffix}@example.com`,
        name: "Jobs Admin",
        role: "ADMIN",
        passwordHash: "test-hash-not-used",
        isActive: true,
      },
    });
    adminId = admin.id;

    const subscription = await prisma.subscription.create({
      data: {
        name: `Sub ${suffix}`,
        amount: "100.00",
        currencyCode: "ETB",
        billingPeriod: "YEARLY",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expirationDate: new Date("2026-12-31T00:00:00.000Z"),
        status: "ACTIVE",
        reminderDaysBefore: [30, 7, 0],
      },
    });
    subscriptionId = subscription.id;

    const client = await prisma.client.create({
      data: {
        name: `Jobs Client ${suffix}`,
        email: `client-${suffix}@example.com`,
      },
    });
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `Jobs Project ${suffix}`,
        agreedPrice: "1000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const agreement = await prisma.maintenanceAgreement.create({
      data: {
        projectId: project.id,
        billingFrequency: "MONTHLY",
        amount: "200.00",
        currencyCode: "ETB",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
      },
    });
    agreementId = agreement.id;

    const cycle = await prisma.maintenanceBillingCycle.create({
      data: {
        maintenanceAgreementId: agreement.id,
        periodStart: new Date("2026-11-01T00:00:00.000Z"),
        periodEnd: new Date("2026-11-30T00:00:00.000Z"),
        dueDate: new Date("2026-11-22T00:00:00.000Z"),
        amount: "200.00",
        currencyCode: "ETB",
        status: "PENDING",
      },
    });
    cycleId = cycle.id;
  });

  afterAll(async () => {
    await prisma.emailDeliveryAttempt.deleteMany({
      where: { emailJob: { toEmail: { contains: suffix } } },
    });
    await prisma.emailJob.deleteMany({
      where: {
        OR: [
          { toEmail: { contains: suffix } },
          { scheduledEvent: { entityId: { in: [subscriptionId, cycleId] } } },
        ],
      },
    });
    await prisma.scheduledEvent.deleteMany({
      where: { entityId: { in: [subscriptionId, cycleId] } },
    });
    await prisma.jobExecutionLog.deleteMany({
      where: { workerId: { startsWith: `test-${suffix}` } },
    });
    if (cycleId) {
      await prisma.maintenanceBillingCycle.deleteMany({ where: { id: cycleId } });
    }
    if (agreementId) {
      await prisma.maintenanceAgreement.deleteMany({ where: { id: agreementId } });
    }
    await prisma.project.deleteMany({
      where: { name: { contains: suffix } },
    });
    await prisma.client.deleteMany({
      where: { name: { contains: suffix } },
    });
    await prisma.subscriptionRenewal.deleteMany({
      where: { subscriptionId },
    });
    await prisma.expense.deleteMany({
      where: { description: { contains: `Sub ${suffix}` } },
    });
    await prisma.subscription.deleteMany({ where: { id: subscriptionId } });
    await prisma.user.deleteMany({
      where: { email: `jobs-admin-${suffix}@example.com` },
    });
    await prisma.$disconnect();
  });

  it("schedules subscription reminders idempotently", async () => {
    const first = await scheduleSubscriptionRemindersFor(prisma, subscriptionId);
    const second = await scheduleSubscriptionRemindersFor(prisma, subscriptionId);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);

    const events = await prisma.scheduledEvent.findMany({
      where: {
        type: "SUBSCRIPTION_REMINDER",
        entityId: subscriptionId,
        status: "PENDING",
      },
    });
    // 30, 7, 0 from override + after-expiration -1
    expect(events).toHaveLength(4);
    expect(new Set(events.map((event) => event.idempotencyKey)).size).toBe(4);
  });

  it("cancels obsolete reminders on confirmed renewal and reschedules", async () => {
    await confirmSubscriptionRenewal(prisma, {
      subscriptionId,
      newExpirationDate: new Date("2027-12-31T00:00:00.000Z"),
      amount: "120.00",
      currencyCode: "ETB",
      confirmedById: adminId,
    });

    const open = await prisma.scheduledEvent.findMany({
      where: {
        entityId: subscriptionId,
        type: "SUBSCRIPTION_REMINDER",
        status: { in: ["PENDING", "APPROVED", "AWAITING_APPROVAL"] },
      },
    });
    expect(
      open.every((event) => {
        const payload = (event.payload ?? {}) as { expirationDate?: string };
        return payload.expirationDate === "2027-12-31";
      }),
    ).toBe(true);
    expect(open.length).toBeGreaterThan(0);
  });

  it("creates maintenance due reminder only with outstanding balance", async () => {
    const asOf = new Date("2026-11-21T00:00:00.000Z");
    const created = await scheduleMaintenanceDueReminders(prisma, { asOf });
    expect(created).toBeGreaterThanOrEqual(1);

    const again = await scheduleMaintenanceDueReminders(prisma, { asOf });
    expect(again).toBe(0);
  });

  it("queues overdue drafts that cannot be sent without approval", async () => {
    const asOf = new Date("2026-11-23T00:00:00.000Z");
    await scheduleOverduePaymentDrafts(prisma, { asOf });

    const events = await claimScheduledEvents(prisma, {
      workerId: `test-${suffix}-claim`,
      now: asOf,
      limit: 50,
    });
    const overdue = events.find(
      (event) =>
        event.type === "OVERDUE_PAYMENT_EMAIL" && event.entityId === cycleId,
    );
    expect(overdue).toBeTruthy();

    await processScheduledEvent(prisma, {
      workerId: `test-${suffix}-process`,
      event: overdue!,
    });

    const draft = await prisma.emailJob.findFirst({
      where: {
        scheduledEventId: overdue!.id,
        status: "AWAITING_APPROVAL",
      },
    });
    expect(draft).toBeTruthy();

    const claimed = await claimEmailJobs(prisma, {
      workerId: `test-${suffix}-email`,
      limit: 50,
    });
    expect(claimed.some((job) => job.id === draft!.id)).toBe(false);

    await expect(
      processEmailJob(prisma, {
        workerId: `test-${suffix}-blocked`,
        job: { ...draft!, status: "AWAITING_APPROVAL" },
        transport: createConsoleEmailTransport(),
        fromAddress: "noreply@example.com",
      }),
    ).resolves.toBeUndefined();

    const stillDraft = await prisma.emailJob.findUniqueOrThrow({
      where: { id: draft!.id },
    });
    expect(stillDraft.status).toBe("AWAITING_APPROVAL");
    expect(stillDraft.sentAt).toBeNull();

    const approved = await approveEmailJob(prisma, {
      emailJobId: draft!.id,
      approvedById: adminId,
    });
    expect(approved.status).toBe("APPROVED");

    const sendable = await claimEmailJobs(prisma, {
      workerId: `test-${suffix}-send`,
      limit: 50,
    });
    const claimedApproved = sendable.find((job) => job.id === draft!.id);
    expect(claimedApproved).toBeTruthy();

    await processEmailJob(prisma, {
      workerId: `test-${suffix}-send`,
      job: claimedApproved!,
      transport: createConsoleEmailTransport(),
      fromAddress: "noreply@example.com",
    });

    const sent = await prisma.emailJob.findUniqueOrThrow({
      where: { id: draft!.id },
    });
    expect(sent.status).toBe("SENT");
    const attempts = await prisma.emailDeliveryAttempt.count({
      where: { emailJobId: draft!.id },
    });
    expect(attempts).toBeGreaterThan(0);
  });

  it("does not re-send after SUCCESS attempt when job crashes mid-flight", async () => {
    resetConsoleEmailIdempotency();
    let sendCalls = 0;
    const transport = createConsoleEmailTransport();
    const countingTransport = {
      async send(message: Parameters<typeof transport.send>[0]) {
        sendCalls += 1;
        return transport.send(message);
      },
    };

    const job = await prisma.emailJob.create({
      data: {
        toEmail: `crash-${suffix}@example.com`,
        subject: `Crash recover ${suffix}`,
        bodyHtml: "<p>hi</p>",
        bodyText: "hi",
        status: "SENDING",
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey: `crash-email:${suffix}`,
        claimedBy: "dead-worker",
        claimedAt: new Date("2020-01-01T00:00:00.000Z"),
        leaseExpiresAt: new Date("2020-01-01T00:01:00.000Z"),
      },
    });

    // First delivery succeeds and records SUCCESS; simulate crash before SENT.
    await processEmailJob(prisma, {
      workerId: `test-${suffix}-crash-1`,
      job,
      transport: countingTransport,
      fromAddress: "noreply@example.com",
    });
    expect(sendCalls).toBe(1);

    await prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: "SENDING",
        claimedBy: "dead-worker",
        claimedAt: new Date("2020-01-01T00:00:00.000Z"),
        leaseExpiresAt: new Date("2020-01-01T00:01:00.000Z"),
        sentAt: null,
      },
    });

    const recovered = await recoverExpiredLeases(prisma, {
      workerId: `test-${suffix}-crash-recover`,
      now: new Date("2026-11-24T00:00:00.000Z"),
    });
    expect(recovered.emails).toBeGreaterThanOrEqual(1);

    const afterRecover = await prisma.emailJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    // SUCCESS attempt already existed → recover finalizes SENT (no requeue).
    expect(afterRecover.status).toBe("SENT");

    // Even if re-processed, transport must not be called again for a new delivery.
    await processEmailJob(prisma, {
      workerId: `test-${suffix}-crash-2`,
      job: afterRecover,
      transport: countingTransport,
      fromAddress: "noreply@example.com",
    });
    expect(sendCalls).toBe(1);

    await prisma.emailDeliveryAttempt.deleteMany({
      where: { emailJobId: job.id },
    });
    await prisma.emailJob.delete({ where: { id: job.id } });
  });

  it("recovers expired worker leases", async () => {
    const event = await prisma.scheduledEvent.create({
      data: {
        type: "SUBSCRIPTION_REMINDER",
        entityType: "Subscription",
        entityId: subscriptionId,
        scheduledFor: new Date("2020-01-01T00:00:00.000Z"),
        status: "PROCESSING",
        idempotencyKey: `lease-test:${suffix}`,
        claimedBy: "dead-worker",
        claimedAt: new Date("2020-01-01T00:00:00.000Z"),
        leaseExpiresAt: new Date("2020-01-01T00:01:00.000Z"),
        payload: {},
      },
    });

    const recovered = await recoverExpiredLeases(prisma, {
      workerId: `test-${suffix}-recover`,
      now: new Date("2026-11-23T00:00:00.000Z"),
    });
    expect(recovered.events).toBeGreaterThanOrEqual(1);

    const restored = await prisma.scheduledEvent.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(restored.status).toBe("PENDING");
    expect(restored.claimedBy).toBeNull();
    expect(restored.leaseExpiresAt).toBeNull();
  });

  it("cancels billing cycle reminders when cycle is marked settled", async () => {
    await prisma.maintenanceBillingCycle.update({
      where: { id: cycleId },
      data: { status: "PAID", amountAllocated: "200.00" },
    });
    await cancelBillingCycleReminders(prisma, cycleId);

    const open = await prisma.scheduledEvent.count({
      where: {
        entityId: cycleId,
        status: { in: ["PENDING", "AWAITING_APPROVAL", "APPROVED", "PROCESSING"] },
      },
    });
    expect(open).toBe(0);

    // restore for cleanup safety
    await prisma.maintenanceBillingCycle.update({
      where: { id: cycleId },
      data: { status: "PENDING", amountAllocated: "0" },
    });
  });

  it("cancelSubscriptionReminders clears open email jobs", async () => {
    await cancelSubscriptionReminders(prisma, subscriptionId);
    const open = await prisma.scheduledEvent.count({
      where: {
        entityId: subscriptionId,
        type: "SUBSCRIPTION_REMINDER",
        status: { in: ["PENDING", "AWAITING_APPROVAL", "APPROVED", "PROCESSING"] },
      },
    });
    expect(open).toBe(0);
  });
});
