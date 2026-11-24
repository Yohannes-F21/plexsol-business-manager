import { Router } from "express";
import {
  approveEmailJob,
  prisma,
  rejectEmailJob,
} from "@plexsol/database";
import {
  emailJobListQuerySchema,
  emailJobRejectSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseBody,
  parseQuery,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth, requireRole } from "../middleware/auth.js";

function mapApprovalError(error: unknown): HttpError {
  const message = error instanceof Error ? error.message : "Approval failed";
  if (/not found/i.test(message)) {
    return new HttpError(message, 404, "not_found");
  }
  if (/cannot be approved|cannot be cancelled/i.test(message)) {
    return new HttpError(message, 409, "conflict");
  }
  return new HttpError(message, 400, "validation_error");
}

export function createEmailJobsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(emailJobListQuerySchema, req.query);
      const where = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { subject: { contains: query.search, mode: "insensitive" as const } },
                { toEmail: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            attempts: { orderBy: { attemptNumber: "asc" } },
            scheduledEvent: true,
            approvedBy: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);

      res.json({
        data: items,
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const item = await prisma.emailJob.findUnique({
        where: { id },
        include: {
          attempts: { orderBy: { attemptNumber: "asc" } },
          scheduledEvent: true,
          approvedBy: { select: { id: true, name: true, email: true } },
          template: true,
        },
      });
      if (!item) throw new HttpError("Email job not found", 404, "not_found");
      res.json({ data: item });
    }),
  );

  router.post(
    "/:id/approve",
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      try {
        const updated = await approveEmailJob(prisma, {
          emailJobId: id,
          approvedById: req.user!.id,
        });
        const full = await prisma.emailJob.findUniqueOrThrow({
          where: { id: updated.id },
          include: {
            attempts: true,
            scheduledEvent: true,
            approvedBy: { select: { id: true, name: true, email: true } },
          },
        });
        res.json({ data: full });
      } catch (error) {
        throw mapApprovalError(error);
      }
    }),
  );

  router.post(
    "/:id/reject",
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(emailJobRejectSchema, req.body ?? {});
      try {
        const updated = await rejectEmailJob(prisma, {
          emailJobId: id,
          rejectedById: req.user!.id,
          reason: body.reason ?? undefined,
        });
        res.json({ data: updated });
      } catch (error) {
        throw mapApprovalError(error);
      }
    }),
  );

  return router;
}
