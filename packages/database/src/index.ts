import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __plexsolPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.__plexsolPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__plexsolPrisma = prisma;
}

export { PrismaClient };
export * from "@prisma/client";
export * from "./money.js";
export * from "./finance/allocations.js";
export * from "./finance/renewals.js";
export * from "./finance/corrections.js";
export * from "./finance/payments.js";
export * from "./finance/billing-cycles.js";
export * from "./finance/balances.js";
export * from "./finance/dates.js";
export * from "./jobs/index.js";
export * from "./reports/index.js";
