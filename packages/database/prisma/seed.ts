import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "@node-rs/argon2";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);
loadEnv({ path: rootEnv });
loadEnv();

const prisma = new PrismaClient();

/**
 * Development reference seed only — currencies, methods, categories, templates,
 * settings, and a bootstrap admin. No sample clients/payments/projects.
 */
async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_SEED !== "true") {
    throw new Error(
      "Refusing to seed production without ALLOW_DB_SEED=true. " +
        "This seed is for development reference data only.",
    );
  }

  console.log("[seed] Upserting currencies…");
  await prisma.currency.upsert({
    where: { code: "ETB" },
    update: { name: "Ethiopian Birr", symbol: "Br", isReporting: true, isActive: true },
    create: {
      code: "ETB",
      name: "Ethiopian Birr",
      symbol: "Br",
      decimalPlaces: 2,
      isReporting: true,
      isActive: true,
    },
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: { name: "US Dollar", symbol: "$", isActive: true },
    create: {
      code: "USD",
      name: "US Dollar",
      symbol: "$",
      decimalPlaces: 2,
      isActive: true,
    },
  });
  await prisma.currency.upsert({
    where: { code: "EUR" },
    update: { name: "Euro", symbol: "€", isActive: true },
    create: {
      code: "EUR",
      name: "Euro",
      symbol: "€",
      decimalPlaces: 2,
      isActive: true,
    },
  });

  console.log("[seed] Ensuring historical exchange rate rows…");
  const rateEffective = new Date("2026-01-01T00:00:00.000Z");
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyCode_toCurrencyCode_effectiveAt: {
        fromCurrencyCode: "USD",
        toCurrencyCode: "ETB",
        effectiveAt: rateEffective,
      },
    },
    update: {},
    create: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "ETB",
      rate: "56.50000000",
      effectiveAt: rateEffective,
      source: "seed",
    },
  });
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyCode_toCurrencyCode_effectiveAt: {
        fromCurrencyCode: "EUR",
        toCurrencyCode: "ETB",
        effectiveAt: rateEffective,
      },
    },
    update: {},
    create: {
      fromCurrencyCode: "EUR",
      toCurrencyCode: "ETB",
      rate: "61.20000000",
      effectiveAt: rateEffective,
      source: "seed",
    },
  });

  console.log("[seed] Upserting payment methods…");
  for (const method of [
    { name: "Bank Transfer", type: "BANK_TRANSFER" as const },
    { name: "Cash", type: "CASH" as const },
    { name: "Card", type: "CARD" as const },
    { name: "Mobile Money", type: "MOBILE_MONEY" as const },
  ]) {
    await prisma.paymentMethod.upsert({
      where: { name: method.name },
      update: { type: method.type, isActive: true },
      create: method,
    });
  }

  console.log("[seed] Upserting expense categories…");
  const expenseCategories = [
    {
      slug: "subscription_renewal",
      name: "Subscription Renewal",
      description: "System category for subscription renewal expenses",
      isSystem: true,
    },
    {
      slug: "general",
      name: "General",
      description: "General operating expenses",
      isSystem: false,
    },
    {
      slug: "software",
      name: "Software",
      description: "Software and tooling (non-renewal)",
      isSystem: false,
    },
  ];
  for (const category of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        isSystem: category.isSystem,
      },
      create: category,
    });
  }

  console.log("[seed] Upserting subscription categories…");
  for (const category of [
    {
      slug: "productivity",
      name: "Productivity",
      description: "Office and productivity tools",
    },
    {
      slug: "design",
      name: "Design",
      description: "Design and creative tools",
    },
    {
      slug: "development",
      name: "Development",
      description: "Developer tools and platforms",
    },
    {
      slug: "infrastructure",
      name: "Infrastructure",
      description: "Hosting, cloud, and infrastructure",
    },
  ]) {
    await prisma.subscriptionCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: category,
    });
  }

  console.log("[seed] Upserting email templates…");
  const templates = [
    {
      key: "subscription_reminder",
      subject: "Subscription reminder: {{subscription_name}}",
      bodyHtml:
        "<p>Hello,</p><p>This is a reminder that <strong>{{subscription_name}}</strong>" +
        " ({{vendor}}) expires on <strong>{{expiration_date}}</strong>.</p>" +
        "<p>Please renew before the expiration date to avoid service interruption.</p>" +
        "<p>Regards,<br/>Plexsol Business Manager</p>",
      bodyText:
        "Reminder: {{subscription_name}} expires on {{expiration_date}}. Please renew before expiration.",
      description: "Subscription expiration reminder (before, on day, or after)",
    },
    {
      key: "maintenance_due_reminder",
      subject: "Maintenance payment due tomorrow — {{project_name}}",
      bodyHtml:
        "<p>Dear {{client_name}},</p>" +
        "<p>This is a professional reminder that the maintenance payment for " +
        "<strong>{{project_name}}</strong> is due on <strong>{{due_date}}</strong>.</p>" +
        "<p>Outstanding balance: <strong>{{outstanding}} {{currency_code}}</strong> " +
        "(invoice amount {{amount}} {{currency_code}}).</p>" +
        "<p>{{payment_instructions}}</p>" +
        "<p>Thank you,<br/>Plexsol Business Manager</p>",
      bodyText:
        "Maintenance payment for {{project_name}} is due on {{due_date}}. " +
        "Outstanding: {{outstanding}} {{currency_code}}. {{payment_instructions}}",
      description: "Automatic email one day before due date when balance remains",
    },
    {
      key: "overdue_payment",
      subject: "Overdue maintenance payment — {{project_name}}",
      bodyHtml:
        "<p>Dear {{client_name}},</p>" +
        "<p>Our records show that payment for <strong>{{project_name}}</strong> " +
        "was due on <strong>{{due_date}}</strong> and remains outstanding.</p>" +
        "<p>Outstanding balance: <strong>{{outstanding}} {{currency_code}}</strong>.</p>" +
        "<p>{{payment_instructions}}</p>" +
        "<p>Please arrange payment at your earliest convenience.</p>" +
        "<p>Regards,<br/>Plexsol Business Manager</p>",
      bodyText:
        "Overdue: {{project_name}} was due {{due_date}}. Outstanding {{outstanding}} {{currency_code}}. {{payment_instructions}}",
      description: "Draft only — requires administrator approval before send",
    },
  ];
  for (const template of templates) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        description: template.description,
      },
      create: template,
    });
  }

  console.log("[seed] Upserting settings…");
  await prisma.setting.upsert({
    where: { key: "reporting_currency" },
    update: { value: "ETB" },
    create: {
      key: "reporting_currency",
      value: "ETB",
      description: "Currency used for financial reporting",
    },
  });
  await prisma.setting.upsert({
    where: { key: "subscription_reminder_days" },
    update: { value: [30, 7, 3, 1, 0] },
    create: {
      key: "subscription_reminder_days",
      value: [30, 7, 3, 1, 0],
      description:
        "Default reminder offsets in days before expiration (0 = on expiration day)",
    },
  });
  await prisma.setting.upsert({
    where: { key: "subscription_reminder_after_expiration_days" },
    update: { value: [-1, -7] },
    create: {
      key: "subscription_reminder_after_expiration_days",
      value: [-1, -7],
      description:
        "Configurable post-expiration reminder offsets (negative days relative to expiration)",
    },
  });
  await prisma.setting.upsert({
    where: { key: "email_max_attempts" },
    update: { value: 3 },
    create: {
      key: "email_max_attempts",
      value: 3,
      description: "Max delivery attempts including the first send",
    },
  });
  await prisma.setting.upsert({
    where: { key: "payment_instructions" },
    update: {
      value:
        "Please transfer the outstanding balance to the account on file and include the project name as the payment reference.",
    },
    create: {
      key: "payment_instructions",
      value:
        "Please transfer the outstanding balance to the account on file and include the project name as the payment reference.",
      description: "Reusable payment instructions inserted into billing emails",
    },
  });

  console.log("[seed] Upserting bootstrap admin user…");
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!";
  // @node-rs/argon2 defaults to Argon2id.
  const passwordHash = await hash(adminPassword, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { email: "admin@plexsol.com" },
    update: {
      name: "Admin",
      role: "ADMIN",
      isActive: true,
      passwordHash,
    },
    create: {
      email: "admin@plexsol.com",
      name: "Admin",
      role: "ADMIN",
      passwordHash,
      isActive: true,
    },
  });

  console.log("[seed] Done (reference data only).");
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      "[seed] Admin password set from default SEED_ADMIN_PASSWORD fallback. Set SEED_ADMIN_PASSWORD in .env for a custom value.",
    );
  }
}

seed()
  .catch((error: unknown) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
