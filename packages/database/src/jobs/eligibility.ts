import type { PrismaClient, ScheduledEvent } from "@prisma/client";
import { money } from "../money.js";
import { startOfUtcDay } from "../finance/dates.js";

type Db = PrismaClient;

export type EligibilityResult =
  | { ok: true; toEmail: string; vars: Record<string, string> }
  | { ok: false; reason: string };

function payloadOf(event: ScheduledEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

/** Revalidate reminder eligibility immediately before enqueue/send. */
export async function revalidateScheduledEvent(
  db: Db,
  event: ScheduledEvent,
): Promise<EligibilityResult> {
  const payload = payloadOf(event);

  if (event.type === "SUBSCRIPTION_REMINDER") {
    const subscription = await db.subscription.findUnique({
      where: { id: event.entityId },
    });
    if (!subscription || subscription.status === "CANCELLED") {
      return { ok: false, reason: "Subscription missing or cancelled" };
    }
    const expected = String(payload.expirationDate ?? "");
    const actual = startOfUtcDay(subscription.expirationDate)
      .toISOString()
      .slice(0, 10);
    if (expected && expected !== actual) {
      return { ok: false, reason: "Expiration changed — reminder obsolete" };
    }

    const admin = await db.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    const toEmail = admin?.email;
    if (!toEmail) {
      return { ok: false, reason: "No admin email recipient configured" };
    }

    return {
      ok: true,
      toEmail,
      vars: {
        subscription_name: subscription.name,
        expiration_date: actual,
        vendor: subscription.vendor ?? "",
      },
    };
  }

  if (
    event.type === "MAINTENANCE_DUE_REMINDER" ||
    event.type === "OVERDUE_PAYMENT_EMAIL"
  ) {
    const cycle = await db.maintenanceBillingCycle.findUnique({
      where: { id: event.entityId },
      include: {
        agreement: { include: { project: { include: { client: true } } } },
      },
    });
    if (!cycle || cycle.status === "CANCELLED" || cycle.status === "PAID") {
      return { ok: false, reason: "Billing cycle settled or missing" };
    }
    const outstanding = money(cycle.amount).sub(money(cycle.amountAllocated));
    if (outstanding.lte(0)) {
      return { ok: false, reason: "No outstanding balance" };
    }

    const clientEmail = cycle.agreement.project.client.email;
    const admin = await db.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    const toEmail = clientEmail || admin?.email;
    if (!toEmail) {
      return { ok: false, reason: "No recipient email for client or admin" };
    }

    const paymentInstructions = await db.setting.findUnique({
      where: { key: "payment_instructions" },
    });
    const instructions =
      typeof paymentInstructions?.value === "string"
        ? paymentInstructions.value
        : "Please settle the outstanding balance using your usual payment method.";

    return {
      ok: true,
      toEmail,
      vars: {
        project_name: cycle.agreement.project.name,
        due_date: startOfUtcDay(cycle.dueDate).toISOString().slice(0, 10),
        amount: cycle.amount.toString(),
        outstanding: outstanding.toString(),
        currency_code: cycle.currencyCode,
        client_name: cycle.agreement.project.client.name,
        payment_instructions: instructions,
      },
    };
  }

  return { ok: false, reason: `Unsupported event type ${event.type}` };
}
