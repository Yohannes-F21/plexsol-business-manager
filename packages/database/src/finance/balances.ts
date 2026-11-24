import type { Prisma, PrismaClient } from "@prisma/client";
import { money } from "../money.js";

type Db = PrismaClient | Prisma.TransactionClient;

export type ProjectBalance = {
  projectId: string;
  name: string;
  currencyCode: string;
  agreedPrice: string;
  amountAllocated: string;
  outstanding: string;
};

export type CycleBalance = {
  cycleId: string;
  maintenanceAgreementId: string;
  projectId: string;
  projectName: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  status: string;
  currencyCode: string;
  amount: string;
  amountAllocated: string;
  outstanding: string;
};

export type PaymentBalance = {
  paymentId: string;
  currencyCode: string;
  amount: string;
  amountEtb: string;
  amountAllocated: string;
  unapplied: string;
  paidAt: Date;
};

export type ClientOutstandingBalances = {
  clientId: string;
  projects: ProjectBalance[];
  billingCycles: CycleBalance[];
  payments: PaymentBalance[];
};

function remaining(total: Prisma.Decimal | string, allocated: Prisma.Decimal | string) {
  const value = money(total).sub(money(allocated));
  return value.lt(0) ? money(0) : value;
}

export async function getClientOutstandingBalances(
  db: Db,
  clientId: string,
): Promise<ClientOutstandingBalances> {
  const projects = await db.project.findMany({
    where: { clientId, status: { not: "CANCELLED" } },
    orderBy: { name: "asc" },
  });

  const projectBalances: ProjectBalance[] = [];
  for (const project of projects) {
    const sum = await db.paymentAllocation.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    const allocated = money(sum._sum.amount ?? 0);
    projectBalances.push({
      projectId: project.id,
      name: project.name,
      currencyCode: project.currencyCode,
      agreedPrice: project.agreedPrice.toString(),
      amountAllocated: allocated.toString(),
      outstanding: remaining(project.agreedPrice, allocated).toString(),
    });
  }

  const cycles = await db.maintenanceBillingCycle.findMany({
    where: {
      status: { not: "CANCELLED" },
      agreement: { project: { clientId } },
    },
    include: {
      agreement: { include: { project: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const billingCycles: CycleBalance[] = cycles.map((cycle) => ({
    cycleId: cycle.id,
    maintenanceAgreementId: cycle.maintenanceAgreementId,
    projectId: cycle.agreement.projectId,
    projectName: cycle.agreement.project.name,
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    dueDate: cycle.dueDate,
    status: cycle.status,
    currencyCode: cycle.currencyCode,
    amount: cycle.amount.toString(),
    amountAllocated: cycle.amountAllocated.toString(),
    outstanding: remaining(cycle.amount, cycle.amountAllocated).toString(),
  }));

  const payments = await db.clientPayment.findMany({
    where: { clientId },
    orderBy: { paidAt: "desc" },
  });

  return {
    clientId,
    projects: projectBalances,
    billingCycles,
    payments: payments.map((payment) => ({
      paymentId: payment.id,
      currencyCode: payment.currencyCode,
      amount: payment.amount.toString(),
      amountEtb: payment.amountEtb.toString(),
      amountAllocated: payment.amountAllocated.toString(),
      unapplied: remaining(payment.amount, payment.amountAllocated).toString(),
      paidAt: payment.paidAt,
    })),
  };
}
