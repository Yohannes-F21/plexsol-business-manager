import { Router } from "express";
import { prisma, type Prisma } from "@plexsol/database";
import {
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
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
import { serializeProject } from "../lib/serialize.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createProjectsRouter(env: ApiEnv): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env);
  router.use(requireAuth);
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(projectListQuerySchema, req.query);
      const where: Prisma.ProjectWhereInput = {
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { client: true },
        }),
      ]);

      res.json({
        data: items.map((item) => serializeProject(item as unknown as Record<string, unknown>)),
        meta: { total, page: query.page, pageSize: query.pageSize },
      });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          client: true,
          maintenanceAgreement: true,
        },
      });
      if (!project) throw new HttpError("Project not found", 404, "not_found");
      res.json({
        data: serializeProject(project as unknown as Record<string, unknown>),
      });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(projectCreateSchema, req.body);
      const client = await prisma.client.findUnique({ where: { id: body.clientId } });
      if (!client) throw new HttpError("Client not found", 404, "not_found");

      const project = await prisma.project.create({
        data: {
          clientId: body.clientId,
          name: body.name,
          description: body.description,
          status: body.status ?? "IN_PROGRESS",
          agreedPrice: body.agreedPrice,
          currencyCode: body.currencyCode ?? "ETB",
          startDate: toDate(body.startDate),
          endDate: toDate(body.endDate),
        },
        include: { client: true },
      });

      res.status(201).json({
        data: serializeProject(project as unknown as Record<string, unknown>),
      });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(projectUpdateSchema, req.body);
      const existing = await prisma.project.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Project not found", 404, "not_found");

      if (body.clientId) {
        const client = await prisma.client.findUnique({ where: { id: body.clientId } });
        if (!client) throw new HttpError("Client not found", 404, "not_found");
      }

      const project = await prisma.project.update({
        where: { id },
        data: {
          ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.agreedPrice !== undefined ? { agreedPrice: body.agreedPrice } : {}),
          ...(body.currencyCode !== undefined ? { currencyCode: body.currencyCode } : {}),
          ...(body.startDate !== undefined
            ? { startDate: toDate(body.startDate) }
            : {}),
          ...(body.endDate !== undefined ? { endDate: toDate(body.endDate) } : {}),
        },
        include: { client: true },
      });

      res.json({
        data: serializeProject(project as unknown as Record<string, unknown>),
      });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.project.findUnique({
        where: { id },
        include: {
          maintenanceAgreement: true,
          _count: { select: { paymentAllocations: true } },
        },
      });
      if (!existing) throw new HttpError("Project not found", 404, "not_found");
      if (existing.maintenanceAgreement || existing._count.paymentAllocations > 0) {
        throw new HttpError(
          "Cannot delete project with maintenance or payment allocations — set status to CANCELLED instead",
          409,
          "conflict",
        );
      }
      await prisma.project.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  return router;
}
