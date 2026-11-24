import { Router } from "express";
import {
  allocatePayment,
  allocatePaymentBatch,
  createClientPayment,
  prisma,
  type Prisma,
} from "@plexsol/database";
import {
  clientPaymentCreateSchema,
  clientPaymentListQuerySchema,
  paymentAllocationBatchSchema,
  paymentAllocationCreateSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseBody,
  parseQuery,
  toDate,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import {
  serializeAllocation,
  serializeClientPayment,
} from "../lib/serialize.js";
import { createRequireAuth } from "../middleware/auth.js";

function mapPaymentError(error: unknown): HttpError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  const message = error instanceof Error ? error.message : "Payment operation failed";

  if (code === "P2025") {
    return new HttpError("Payment or allocation target not found", 404, "not_found");
  }
  if (/Transaction not found|Transaction API error/i.test(message)) {
    return new HttpError(
      "Payment allocation timed out — retry the request",
      503,
      "transaction_timeout",
    );
  }
  if (
    /exceeds|over-allocation|must match|must own|exactly one|cancelled|inactive|amountEtb|For ETB payments|Exchange rate|greater than zero|At least one/i.test(
      message,
    )
  ) {
    return new HttpError(message, 400, "validation_error");
  }
  if (code === "P2002") {
    return new HttpError(message, 409, "conflict");
  }
  return new HttpError(message, 400, "payment_error");
}

export function createPaymentsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(clientPaymentListQuerySchema, req.query);
      const where: Prisma.ClientPaymentWhereInput = {
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.search
          ? {
              OR: [
                { reference: { contains: query.search, mode: "insensitive" } },
                { notes: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.clientPayment.count({ where }),
        prisma.clientPayment.findMany({
          where,
          orderBy: { paidAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            client: true,
            paymentMethod: true,
            _count: { select: { allocations: true } },
          },
        }),
      ]);

      res.json({
        data: items.map((item) =>
          serializeClientPayment(item as unknown as Record<string, unknown>),
        ),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.clientPayment.findUnique({
        where: { id },
        include: {
          client: true,
          paymentMethod: true,
          exchangeRate: true,
          allocations: {
            include: {
              project: true,
              billingCycle: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!item) throw new HttpError("Payment not found", 404, "not_found");
      res.json({
        data: serializeClientPayment(item as unknown as Record<string, unknown>),
      });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(clientPaymentCreateSchema, req.body);
      try {
        const payment = await createClientPayment(prisma, {
          clientId: body.clientId,
          amount: body.amount,
          currencyCode: body.currencyCode ?? "ETB",
          amountEtb: body.amountEtb,
          exchangeRateId: body.exchangeRateId ?? undefined,
          paymentMethodId: body.paymentMethodId ?? undefined,
          paidAt: toDate(body.paidAt) ?? undefined,
          reference: body.reference,
          notes: body.notes,
          createdById: req.user?.id,
        });
        const full = await prisma.clientPayment.findUniqueOrThrow({
          where: { id: payment.id },
          include: { client: true, paymentMethod: true },
        });
        res.status(201).json({
          data: serializeClientPayment(full as unknown as Record<string, unknown>),
        });
      } catch (error) {
        throw mapPaymentError(error);
      }
    }),
  );

  router.post(
    "/:id/allocations",
    asyncHandler(async (req, res) => {
      const paymentId = paramId(req);
      const body = parseBody(paymentAllocationCreateSchema, req.body);
      try {
        const allocation = await allocatePayment(prisma, {
          clientPaymentId: paymentId,
          amount: body.amount,
          target: body.projectId
            ? { projectId: body.projectId }
            : { billingCycleId: body.billingCycleId! },
          notes: body.notes ?? undefined,
          actorUserId: req.user?.id,
        });
        res.status(201).json({
          data: serializeAllocation(allocation as unknown as Record<string, unknown>),
        });
      } catch (error) {
        throw mapPaymentError(error);
      }
    }),
  );

  router.post(
    "/:id/allocations/batch",
    asyncHandler(async (req, res) => {
      const paymentId = paramId(req);
      const body = parseBody(paymentAllocationBatchSchema, req.body);
      try {
        const allocations = await allocatePaymentBatch(prisma, {
          clientPaymentId: paymentId,
          actorUserId: req.user?.id,
          allocations: body.allocations.map((line) => ({
            amount: line.amount,
            notes: line.notes ?? undefined,
            target: line.projectId
              ? { projectId: line.projectId }
              : { billingCycleId: line.billingCycleId! },
          })),
        });
        res.status(201).json({
          data: allocations.map((allocation) =>
            serializeAllocation(allocation as unknown as Record<string, unknown>),
          ),
        });
      } catch (error) {
        throw mapPaymentError(error);
      }
    }),
  );

  return router;
}
