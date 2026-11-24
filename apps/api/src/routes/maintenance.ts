import { Router } from "express";
import {
  generateBillingCycles,
  prisma,
  type Prisma,
} from "@plexsol/database";
import {
  billingCycleListQuerySchema,
  generateBillingCyclesSchema,
  maintenanceAgreementCreateSchema,
  maintenanceAgreementListQuerySchema,
  maintenanceAgreementUpdateSchema,
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
  serializeBillingCycle,
  serializeMaintenanceAgreement,
} from "../lib/serialize.js";
import { createRequireAuth } from "../middleware/auth.js";

function mapMaintenanceError(error: unknown): HttpError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  const message =
    error instanceof Error ? error.message : "Maintenance operation failed";

  if (code === "P2025") {
    return new HttpError("Agreement not found", 404, "not_found");
  }
  if (code === "P2002") {
    return new HttpError(
      "Project already has a maintenance agreement",
      409,
      "conflict",
    );
  }
  if (/ACTIVE|generate|safety limit/i.test(message)) {
    return new HttpError(message, 400, "validation_error");
  }
  return new HttpError(message, 400, "maintenance_error");
}

export function createMaintenanceRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/agreements",
    asyncHandler(async (req, res) => {
      const query = parseQuery(maintenanceAgreementListQuerySchema, req.query);
      const where: Prisma.MaintenanceAgreementWhereInput = {
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.clientId
          ? { project: { clientId: query.clientId } }
          : {}),
        ...(query.search
          ? {
              OR: [
                { notes: { contains: query.search, mode: "insensitive" } },
                {
                  project: {
                    name: { contains: query.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.maintenanceAgreement.count({ where }),
        prisma.maintenanceAgreement.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            project: { include: { client: true } },
            _count: { select: { billingCycles: true } },
          },
        }),
      ]);

      res.json({
        data: items.map((item) =>
          serializeMaintenanceAgreement(item as unknown as Record<string, unknown>),
        ),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/agreements/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.maintenanceAgreement.findUnique({
        where: { id },
        include: {
          project: { include: { client: true } },
          billingCycles: { orderBy: { periodStart: "asc" } },
        },
      });
      if (!item) throw new HttpError("Agreement not found", 404, "not_found");
      res.json({
        data: {
          ...serializeMaintenanceAgreement(
            item as unknown as Record<string, unknown>,
          ),
          billingCycles: item.billingCycles.map((cycle) =>
            serializeBillingCycle(cycle as unknown as Record<string, unknown>),
          ),
        },
      });
    }),
  );

  router.post(
    "/agreements",
    asyncHandler(async (req, res) => {
      const body = parseBody(maintenanceAgreementCreateSchema, req.body);
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
      });
      if (!project) throw new HttpError("Project not found", 404, "not_found");

      const startDate = toDate(body.startDate);
      if (!startDate) {
        throw new HttpError("startDate is required", 400, "validation_error");
      }

      try {
        const created = await prisma.maintenanceAgreement.create({
          data: {
            projectId: body.projectId,
            billingFrequency: body.billingFrequency,
            amount: body.amount,
            currencyCode: body.currencyCode ?? "ETB",
            startDate,
            endDate: toDate(body.endDate),
            status: body.status ?? "ACTIVE",
            notes: body.notes,
          },
        });

        // Generate outside the create statement so Neon interactive tx does not time out.
        if ((body.generateCycles ?? true) && created.status === "ACTIVE") {
          await generateBillingCycles(prisma, {
            agreementId: created.id,
            actorUserId: req.user?.id,
          });
        }

        const full = await prisma.maintenanceAgreement.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            project: { include: { client: true } },
            _count: { select: { billingCycles: true } },
          },
        });

        res.status(201).json({
          data: serializeMaintenanceAgreement(
            full as unknown as Record<string, unknown>,
          ),
        });
      } catch (error) {
        throw mapMaintenanceError(error);
      }
    }),
  );

  router.patch(
    "/agreements/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(maintenanceAgreementUpdateSchema, req.body);
      const existing = await prisma.maintenanceAgreement.findUnique({
        where: { id },
      });
      if (!existing) throw new HttpError("Agreement not found", 404, "not_found");

      const item = await prisma.maintenanceAgreement.update({
        where: { id },
        data: {
          ...(body.billingFrequency !== undefined
            ? { billingFrequency: body.billingFrequency }
            : {}),
          ...(body.amount !== undefined ? { amount: body.amount } : {}),
          ...(body.currencyCode !== undefined
            ? { currencyCode: body.currencyCode }
            : {}),
          ...(body.startDate !== undefined
            ? { startDate: toDate(body.startDate) ?? undefined }
            : {}),
          ...(body.endDate !== undefined ? { endDate: toDate(body.endDate) } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
        include: {
          project: { include: { client: true } },
          _count: { select: { billingCycles: true } },
        },
      });

      res.json({
        data: serializeMaintenanceAgreement(
          item as unknown as Record<string, unknown>,
        ),
      });
    }),
  );

  router.post(
    "/agreements/:id/generate-cycles",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(generateBillingCyclesSchema, req.body ?? {});
      try {
        const result = await generateBillingCycles(prisma, {
          agreementId: id,
          asOf: toDate(body.asOf) ?? undefined,
          actorUserId: req.user?.id,
        });
        res.status(201).json({
          data: {
            created: result.created.map((cycle) =>
              serializeBillingCycle(cycle as unknown as Record<string, unknown>),
            ),
            createdCount: result.created.length,
            skipped: result.skipped,
          },
        });
      } catch (error) {
        throw mapMaintenanceError(error);
      }
    }),
  );

  router.get(
    "/cycles",
    asyncHandler(async (req, res) => {
      const query = parseQuery(billingCycleListQuerySchema, req.query);
      const where: Prisma.MaintenanceBillingCycleWhereInput = {
        ...(query.maintenanceAgreementId
          ? { maintenanceAgreementId: query.maintenanceAgreementId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.clientId
          ? { agreement: { project: { clientId: query.clientId } } }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.maintenanceBillingCycle.count({ where }),
        prisma.maintenanceBillingCycle.findMany({
          where,
          orderBy: { dueDate: "asc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            agreement: { include: { project: { include: { client: true } } } },
          },
        }),
      ]);

      res.json({
        data: items.map((item) =>
          serializeBillingCycle(item as unknown as Record<string, unknown>),
        ),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/cycles/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.maintenanceBillingCycle.findUnique({
        where: { id },
        include: {
          agreement: { include: { project: { include: { client: true } } } },
          allocations: { include: { clientPayment: true } },
        },
      });
      if (!item) throw new HttpError("Billing cycle not found", 404, "not_found");
      res.json({
        data: serializeBillingCycle(item as unknown as Record<string, unknown>),
      });
    }),
  );

  return router;
}
