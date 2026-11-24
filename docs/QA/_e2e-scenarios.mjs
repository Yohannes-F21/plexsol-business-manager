/**
 * Isolated E2E scenario probe for final system audit.
 * Creates tagged QA rows, verifies balances, then cleans up.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PrismaClient,
  allocatePaymentBatch,
  confirmSubscriptionRenewal,
  createClientPayment,
  generateBillingCycles,
  scheduleSubscriptionRemindersFor,
  cancelSubscriptionReminders,
  approveEmailJob,
  claimEmailJobs,
  claimScheduledEvents,
  processEmailJob,
  processScheduledEvent,
  createConsoleEmailTransport,
  scheduleMaintenanceDueReminders,
  scheduleOverduePaymentDrafts,
  recoverExpiredLeases,
} from "../../packages/database/dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq);
  let value = trimmed.slice(eq + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (process.env[key] === undefined) process.env[key] = value;
}

const prisma = new PrismaClient();
const tag = `e2e${Date.now()}`;
const results = [];

function moneyEq(actual, expected) {
  return Number(actual) === Number(expected);
}

function record(id, status, detail) {
  results.push({ id, status, detail });
  console.error(`[${status}] ${id}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}

async function cleanupClient(clientId) {
  const projects = await prisma.project.findMany({ where: { clientId }, select: { id: true } });
  const projectIds = projects.map((p) => p.id);
  const agreements = await prisma.maintenanceAgreement.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true },
  });
  const agreementIds = agreements.map((a) => a.id);
  const cycles = await prisma.maintenanceBillingCycle.findMany({
    where: { maintenanceAgreementId: { in: agreementIds } },
    select: { id: true },
  });
  const cycleIds = cycles.map((c) => c.id);
  const payments = await prisma.clientPayment.findMany({
    where: { clientId },
    select: { id: true },
  });
  const paymentIds = payments.map((p) => p.id);

  await prisma.emailDeliveryAttempt.deleteMany({
    where: { emailJob: { scheduledEvent: { entityId: { in: [...cycleIds, ...projectIds] } } } },
  }).catch(() => {});
  await prisma.emailJob.deleteMany({
    where: {
      OR: [
        { scheduledEvent: { entityId: { in: cycleIds } } },
        { subject: { contains: tag } },
      ],
    },
  }).catch(() => {});
  await prisma.scheduledEvent.deleteMany({
    where: { entityId: { in: [...cycleIds, ...projectIds] } },
  }).catch(() => {});
  await prisma.paymentAllocation.deleteMany({
    where: {
      OR: [
        { clientPaymentId: { in: paymentIds } },
        { projectId: { in: projectIds } },
        { billingCycleId: { in: cycleIds } },
      ],
    },
  });
  await prisma.clientPayment.deleteMany({ where: { clientId } });
  await prisma.maintenanceBillingCycle.deleteMany({
    where: { maintenanceAgreementId: { in: agreementIds } },
  });
  await prisma.maintenanceAgreement.deleteMany({ where: { id: { in: agreementIds } } });
  await prisma.project.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
}

async function scenario1() {
  const client = await prisma.client.create({
    data: {
      name: `QA S1 ${tag}`,
      email: `qa-s1-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S1 Project ${tag}`,
        agreedPrice: "10000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const advance = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "3000.00",
      currencyCode: "ETB",
      reference: `S1-ADV-${tag}`,
    });
    await allocatePaymentBatch(prisma, {
      clientPaymentId: advance.id,
      allocations: [{ amount: "3000.00", target: { projectId: project.id } }],
    });
    const finalPay = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "7000.00",
      currencyCode: "ETB",
      reference: `S1-FULL-${tag}`,
    });
    await allocatePaymentBatch(prisma, {
      clientPaymentId: finalPay.id,
      allocations: [{ amount: "7000.00", target: { projectId: project.id } }],
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "COMPLETED", endDate: new Date() },
    });
    const allocated = await prisma.paymentAllocation.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    const agreement = await prisma.maintenanceAgreement.findUnique({
      where: { projectId: project.id },
    });
    const status = (await prisma.project.findUnique({ where: { id: project.id } }))
      ?.status;
    const ok =
      moneyEq(allocated._sum.amount, 10000) && !agreement && status === "COMPLETED";
    record("S1_prepaid_project", ok ? "PASS" : "FAIL", {
      allocated: String(allocated._sum.amount),
      hasMaintenance: Boolean(agreement),
      status,
    });
  } finally {
    await cleanupClient(client.id);
  }
}

async function scenario2() {
  const client = await prisma.client.create({
    data: {
      name: `QA S2 ${tag}`,
      email: `qa-s2-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S2 Project ${tag}`,
        agreedPrice: "8000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const payDev = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "8000.00",
      currencyCode: "ETB",
    });
    await allocatePaymentBatch(prisma, {
      clientPaymentId: payDev.id,
      allocations: [{ amount: "8000.00", target: { projectId: project.id } }],
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "COMPLETED" },
    });
    const agreement = await prisma.maintenanceAgreement.create({
      data: {
        projectId: project.id,
        amount: "1200.00",
        currencyCode: "ETB",
        billingFrequency: "MONTHLY",
        startDate: new Date("2026-01-15"),
        status: "ACTIVE",
      },
    });
    const generated = await generateBillingCycles(prisma, {
      agreementId: agreement.id,
      asOf: new Date("2026-03-31"),
    });
    const cycle =
      generated.created[0] ??
      (await prisma.maintenanceBillingCycle.findFirst({
        where: { maintenanceAgreementId: agreement.id },
        orderBy: { periodStart: "asc" },
      }));
    if (!cycle) throw new Error("No cycle generated");
    const partial = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "500.00",
      currencyCode: "ETB",
    });
    await allocatePaymentBatch(prisma, {
      clientPaymentId: partial.id,
      allocations: [{ amount: "500.00", target: { billingCycleId: cycle.id } }],
    });
    const remaining = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "700.00",
      currencyCode: "ETB",
    });
    await allocatePaymentBatch(prisma, {
      clientPaymentId: remaining.id,
      allocations: [{ amount: "700.00", target: { billingCycleId: cycle.id } }],
    });
    const settled = await prisma.maintenanceBillingCycle.findUniqueOrThrow({
      where: { id: cycle.id },
    });
    const projectAlloc = await prisma.paymentAllocation.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    const ok =
      moneyEq(settled.amountAllocated, 1200) &&
      settled.status === "PAID" &&
      moneyEq(projectAlloc._sum.amount, 8000);
    record("S2_project_then_maintenance", ok ? "PASS" : "FAIL", {
      cycleStatus: settled.status,
      cycleAllocated: String(settled.amountAllocated),
      projectAllocated: String(projectAlloc._sum.amount),
      createdCycles: generated.created.length,
      skipped: generated.skipped,
    });
  } finally {
    await cleanupClient(client.id);
  }
}

async function scenario3() {
  const client = await prisma.client.create({
    data: {
      name: `QA S3 ${tag}`,
      email: `qa-s3-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const p1 = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S3 P1 ${tag}`,
        agreedPrice: "5000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const p2 = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S3 P2 ${tag}`,
        agreedPrice: "4000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const agreement = await prisma.maintenanceAgreement.create({
      data: {
        projectId: p1.id,
        amount: "1000.00",
        currencyCode: "ETB",
        billingFrequency: "MONTHLY",
        startDate: new Date("2026-02-01"),
        status: "ACTIVE",
      },
    });
    await generateBillingCycles(prisma, {
      agreementId: agreement.id,
      asOf: new Date("2026-02-28"),
    });
    const cycle = await prisma.maintenanceBillingCycle.findFirstOrThrow({
      where: { maintenanceAgreementId: agreement.id },
    });
    const receipt = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "6500.00",
      currencyCode: "ETB",
      reference: `S3-MULTI-${tag}`,
    });
    await allocatePaymentBatch(prisma, {
      clientPaymentId: receipt.id,
      allocations: [
        { amount: "3000.00", target: { projectId: p1.id } },
        { amount: "2500.00", target: { projectId: p2.id } },
        { amount: "1000.00", target: { billingCycleId: cycle.id } },
      ],
    });
    const payment = await prisma.clientPayment.findUniqueOrThrow({
      where: { id: receipt.id },
    });
    const allocCount = await prisma.paymentAllocation.count({
      where: { clientPaymentId: receipt.id },
    });
    const incomeRows = await prisma.clientPayment.count({
      where: { reference: `S3-MULTI-${tag}` },
    });
    const ok =
      moneyEq(payment.amountAllocated, 6500) &&
      allocCount === 3 &&
      incomeRows === 1 &&
      moneyEq(payment.amountEtb, 6500);
    record("S3_multi_obligation_payment", ok ? "PASS" : "FAIL", {
      amountAllocated: String(payment.amountAllocated),
      allocCount,
      incomeRows,
      amountEtb: String(payment.amountEtb),
    });
  } finally {
    await cleanupClient(client.id);
  }
}

async function scenario4() {
  const subCat = await prisma.subscriptionCategory.findFirst();
  const sub = await prisma.subscription.create({
    data: {
      name: `QA S4 Sub ${tag}`,
      vendor: "QA",
      amount: "100.00",
      currencyCode: "ETB",
      billingPeriod: "YEARLY",
      startDate: new Date("2026-01-01"),
      expirationDate: new Date("2026-12-15"),
      categoryId: subCat?.id,
      status: "ACTIVE",
      reminderDaysBefore: [30, 7, 3, 1, 0],
    },
  });
  try {
    const scheduled = await scheduleSubscriptionRemindersFor(prisma, sub.id);
    const before = await prisma.scheduledEvent.count({
      where: { entityId: sub.id, type: "SUBSCRIPTION_REMINDER", status: "PENDING" },
    });
    const renewal = await confirmSubscriptionRenewal(prisma, {
      subscriptionId: sub.id,
      newExpirationDate: new Date("2027-12-15"),
      amount: "100.00",
      currencyCode: "ETB",
    });
    const expenses = await prisma.expense.count({
      where: { id: renewal.expenseId },
    });
    const obsoleteCancelled = await prisma.scheduledEvent.count({
      where: {
        entityId: sub.id,
        type: "SUBSCRIPTION_REMINDER",
        status: "CANCELLED",
      },
    });
    const openAfter = await prisma.scheduledEvent.findMany({
      where: {
        entityId: sub.id,
        type: "SUBSCRIPTION_REMINDER",
        status: { in: ["PENDING", "APPROVED"] },
      },
    });
    const renewals = await prisma.subscriptionRenewal.count({
      where: { subscriptionId: sub.id },
    });
    const ok =
      scheduled >= 1 &&
      before >= 1 &&
      expenses === 1 &&
      obsoleteCancelled >= 1 &&
      openAfter.every((event) => {
        const payload = (event.payload ?? {});
        return payload.expirationDate === "2027-12-15";
      }) &&
      renewals === 1;
    record("S4_subscription_renewal", ok ? "PASS" : "FAIL", {
      scheduledCreated: scheduled,
      remindersBefore: before,
      obsoleteCancelled,
      openAfter: openAfter.length,
      renewals,
      expenses,
    });
  } finally {
    await cancelSubscriptionReminders(prisma, sub.id).catch(() => {});
    await prisma.emailJob.deleteMany({
      where: { scheduledEvent: { entityId: sub.id } },
    }).catch(() => {});
    await prisma.scheduledEvent.deleteMany({ where: { entityId: sub.id } });
    const renewals = await prisma.subscriptionRenewal.findMany({
      where: { subscriptionId: sub.id },
    });
    await prisma.subscriptionRenewal.deleteMany({ where: { subscriptionId: sub.id } });
    await prisma.expense.deleteMany({
      where: { id: { in: renewals.map((r) => r.expenseId) } },
    });
    await prisma.subscription.delete({ where: { id: sub.id } }).catch(() => {});
  }
}

async function scenario5() {
  const client = await prisma.client.create({
    data: {
      name: `QA S5 ${tag}`,
      email: `qa-s5-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S5 Project ${tag}`,
        agreedPrice: "1000.00",
        currencyCode: "ETB",
        status: "COMPLETED",
      },
    });
    const agreement = await prisma.maintenanceAgreement.create({
      data: {
        projectId: project.id,
        amount: "900.00",
        currencyCode: "ETB",
        billingFrequency: "MONTHLY",
        startDate: new Date("2026-11-01"),
        status: "ACTIVE",
      },
    });
    await generateBillingCycles(prisma, {
      agreementId: agreement.id,
      asOf: new Date("2026-11-30"),
    });
    const cycle = await prisma.maintenanceBillingCycle.findFirstOrThrow({
      where: { maintenanceAgreementId: agreement.id },
    });
    const due = new Date("2026-11-20T00:00:00.000Z");
    await prisma.maintenanceBillingCycle.update({
      where: { id: cycle.id },
      data: { dueDate: due, status: "PENDING", amountAllocated: 0 },
    });

    const dayBefore = new Date("2026-11-19T00:00:00.000Z");
    const dueReminders = await scheduleMaintenanceDueReminders(prisma, {
      asOf: dayBefore,
    });
    const dueEvents = await prisma.scheduledEvent.count({
      where: {
        entityId: cycle.id,
        type: "MAINTENANCE_DUE_REMINDER",
      },
    });

    const overdueAsOf = new Date("2026-11-22T00:00:00.000Z");
    await scheduleOverduePaymentDrafts(prisma, { asOf: overdueAsOf });
    const claimedEvents = await claimScheduledEvents(prisma, {
      workerId: `qa-s5-claim-${tag}`,
      now: overdueAsOf,
      limit: 50,
    });
    const overdueEvent = claimedEvents.find(
      (event) =>
        event.type === "OVERDUE_PAYMENT_EMAIL" && event.entityId === cycle.id,
    );
    if (overdueEvent) {
      await processScheduledEvent(prisma, {
        workerId: `qa-s5-process-${tag}`,
        event: overdueEvent,
      });
    }
    const draft = await prisma.emailJob.findFirst({
      where: {
        scheduledEvent: { entityId: cycle.id, type: "OVERDUE_PAYMENT_EMAIL" },
        status: "AWAITING_APPROVAL",
      },
    });

    let sendWithoutApprovalBlocked = true;
    if (draft) {
      const claimed = await claimEmailJobs(prisma, {
        workerId: `qa-s5-${tag}`,
        limit: 50,
      });
      sendWithoutApprovalBlocked = !claimed.some((j) => j.id === draft.id);
    }

    let sentAfterApprove = false;
    if (draft) {
      const admin = await prisma.user.findFirst({
        where: { role: "ADMIN", isActive: true },
      });
      if (!admin) throw new Error("Admin user required for approval");
      await approveEmailJob(prisma, {
        emailJobId: draft.id,
        approvedById: admin.id,
      });
      const claimed = await claimEmailJobs(prisma, {
        workerId: `qa-s5-send-${tag}`,
        limit: 50,
      });
      const job = claimed.find((j) => j.id === draft.id);
      if (job) {
        await processEmailJob(prisma, {
          workerId: `qa-s5-send-${tag}`,
          job,
          transport: createConsoleEmailTransport(),
          fromAddress: "qa@plexsol.local",
        });
        const updated = await prisma.emailJob.findUnique({ where: { id: job.id } });
        sentAfterApprove = updated?.status === "SENT";
      }
    }

    const ok =
      dueReminders >= 1 &&
      dueEvents >= 1 &&
      Boolean(draft) &&
      sendWithoutApprovalBlocked &&
      sentAfterApprove;
    record("S5_maintenance_reminder_overdue", ok ? "PASS" : "FAIL", {
      dueRemindersCreated: dueReminders,
      dueEvents,
      draftStatus: draft?.status ?? null,
      sendWithoutApprovalBlocked,
      sentAfterApprove,
    });
  } finally {
    await cleanupClient(client.id);
  }
}

async function scenario6() {
  const transportCalls = { count: 0, failUntil: 2 };
  const flaky = {
    async send(msg) {
      transportCalls.count += 1;
      if (transportCalls.count <= transportCalls.failUntil) {
        return {
          ok: false,
          permanent: false,
          errorMessage: `temp fail ${transportCalls.count}`,
          providerResponse: "TEMP",
        };
      }
      return {
        ok: true,
        providerResponse: "OK",
        messageId: `msg-${transportCalls.count}`,
      };
    },
  };

  const template = await prisma.emailTemplate.findFirst({
    where: { key: "subscription_reminder" },
  });
  if (!template) {
    record("S6_email_retry_recovery", "BLOCKED", "missing subscription_reminder template");
    return;
  }

  const job = await prisma.emailJob.create({
    data: {
      templateId: template.id,
      toEmail: `qa-s6-${tag}@example.com`,
      subject: `QA S6 ${tag}`,
      bodyHtml: "<p>retry test</p>",
      bodyText: "retry test",
      status: "PENDING",
      maxAttempts: 3,
      idempotencyKey: `qa-s6-${tag}`,
    },
  });

  try {
    // attempt 1 fail
    let claimed = await claimEmailJobs(prisma, { workerId: `s6a-${tag}`, limit: 5 });
    let current = claimed.find((j) => j.id === job.id);
    if (current) {
      await processEmailJob(prisma, {
        workerId: `s6a-${tag}`,
        job: current,
        transport: flaky,
        fromAddress: "qa@plexsol.local",
      });
    }
    // attempt 2 fail
    claimed = await claimEmailJobs(prisma, { workerId: `s6b-${tag}`, limit: 5 });
    current = claimed.find((j) => j.id === job.id);
    if (current) {
      await processEmailJob(prisma, {
        workerId: `s6b-${tag}`,
        job: current,
        transport: flaky,
        fromAddress: "qa@plexsol.local",
      });
    }
    // simulate crash mid-send: claim, send success via transport outside process, recover lease
    claimed = await claimEmailJobs(prisma, { workerId: `s6crash-${tag}`, limit: 5 });
    current = claimed.find((j) => j.id === job.id);
    let duplicateRisk = false;
    if (current) {
      // Force lease expiry while SENDING
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: "SENDING",
          leaseExpiresAt: new Date(Date.now() - 1000),
          claimedBy: `s6crash-${tag}`,
        },
      });
      await recoverExpiredLeases(prisma, { workerId: `s6recover-${tag}` });
      // Successful send after recovery
      claimed = await claimEmailJobs(prisma, { workerId: `s6c-${tag}`, limit: 5 });
      current = claimed.find((j) => j.id === job.id);
      if (current) {
        await processEmailJob(prisma, {
          workerId: `s6c-${tag}`,
          job: current,
          transport: flaky,
          fromAddress: "qa@plexsol.local",
        });
      }
      // If transport was already called successfully once and job reclaimed again, risk exists.
      // Our flaky transport succeeds on 3rd call — after recovery that is the success path.
      duplicateRisk = transportCalls.count > 3;
    }

    const finalJob = await prisma.emailJob.findUniqueOrThrow({ where: { id: job.id } });
    const attempts = await prisma.emailDeliveryAttempt.count({
      where: { emailJobId: job.id },
    });
    const ok =
      finalJob.status === "SENT" &&
      attempts <= 3 &&
      transportCalls.count <= 3 &&
      !duplicateRisk;
    record("S6_email_retry_recovery", ok ? "PASS" : "FAIL", {
      finalStatus: finalJob.status,
      attemptCount: finalJob.attemptCount,
      deliveryAttempts: attempts,
      transportCalls: transportCalls.count,
      duplicateRisk,
    });
  } finally {
    await prisma.emailDeliveryAttempt.deleteMany({ where: { emailJobId: job.id } });
    await prisma.emailJob.delete({ where: { id: job.id } }).catch(() => {});
  }
}

async function scenario7() {
  const ms = Date.now() % 1000;
  const rate1 = await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "50.00000000",
      effectiveAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, ms)),
      source: `qa-s7-${tag}`,
    },
  });
  const rate2 = await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "60.00000000",
      effectiveAt: new Date(Date.UTC(2026, 5, 1, 0, 0, 0, ms)),
      source: `qa-s7-${tag}`,
    },
  });
  const client = await prisma.client.create({
    data: {
      name: `QA S7 ${tag}`,
      email: `qa-s7-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const payment = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "10.00",
      currencyCode: "USD",
      exchangeRateId: rate1.id,
      paidAt: new Date("2026-02-01"),
      reference: `S7-${tag}`,
    });
    const afterRateChange = await prisma.clientPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    // Later rate exists (rate2). Historical snapshot must stay 500.
    const ok = moneyEq(afterRateChange.amountEtb, 500);
    record("S7_historical_fx_snapshot", ok ? "PASS" : "FAIL", {
      amountEtb: String(afterRateChange.amountEtb),
      rate1: "50",
      rate2Present: Boolean(rate2.id),
    });
  } finally {
    await cleanupClient(client.id);
    await prisma.exchangeRate.deleteMany({ where: { source: `qa-s7-${tag}` } });
  }
}

async function scenario8() {
  const client = await prisma.client.create({
    data: {
      name: `QA S8 ${tag}`,
      email: `qa-s8-${tag}@example.com`,
      isActive: true,
    },
  });
  try {
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: `QA S8 Project ${tag}`,
        agreedPrice: "1000.00",
        currencyCode: "ETB",
        status: "IN_PROGRESS",
      },
    });
    const payment = await createClientPayment(prisma, {
      clientId: client.id,
      amount: "1000.00",
      currencyCode: "ETB",
    });
    const attempts = await Promise.allSettled([
      allocatePaymentBatch(prisma, {
        clientPaymentId: payment.id,
        allocations: [{ amount: "1000.00", target: { projectId: project.id } }],
      }),
      allocatePaymentBatch(prisma, {
        clientPaymentId: payment.id,
        allocations: [{ amount: "1000.00", target: { projectId: project.id } }],
      }),
    ]);
    const successes = attempts.filter((a) => a.status === "fulfilled").length;
    const failures = attempts.filter((a) => a.status === "rejected").length;
    const refreshed = await prisma.clientPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const allocSum = await prisma.paymentAllocation.aggregate({
      where: { clientPaymentId: payment.id },
      _sum: { amount: true },
    });
    const ok =
      successes === 1 &&
      failures === 1 &&
      moneyEq(refreshed.amountAllocated, 1000) &&
      moneyEq(allocSum._sum.amount, 1000);
    record("S8_concurrency_rollback", ok ? "PASS" : "FAIL", {
      successes,
      failures,
      amountAllocated: String(refreshed.amountAllocated),
      allocSum: String(allocSum._sum.amount),
    });
  } finally {
    await cleanupClient(client.id);
  }
}

async function main() {
  await prisma.currency.upsert({
    where: { code: "ETB" },
    update: {},
    create: { code: "ETB", name: "Ethiopian Birr", symbol: "Br", isReporting: true },
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "US Dollar", symbol: "$" },
  });

  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4();
  await scenario5();
  await scenario6();
  await scenario7();
  await scenario8();

  console.log(JSON.stringify({ tag, results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
