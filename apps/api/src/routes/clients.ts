import { Router } from "express";
import { prisma, type Prisma } from "@plexsol/database";
import {
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  paramId,
  parseBody,
  parseQuery,
} from "../lib/http.js";
import { serializeProject } from "../lib/serialize.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createClientsRouter(env: ApiEnv): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env);

  router.use(requireAuth);
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = parseQuery(clientListQuerySchema, req.query);
      const where: Prisma.ClientWhereInput = {
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { company: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [total, items] = await Promise.all([
        prisma.client.count({ where }),
        prisma.client.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { _count: { select: { projects: true } } },
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
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          projects: { orderBy: { updatedAt: "desc" } },
          _count: { select: { projects: true, payments: true } },
        },
      });
      if (!client) throw new HttpError("Client not found", 404, "not_found");
      res.json({
        data: {
          ...client,
          projects: client.projects.map((project) =>
            serializeProject(project as unknown as Record<string, unknown>),
          ),
        },
      });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const body = parseBody(clientCreateSchema, req.body);
      const client = await prisma.client.create({
        data: {
          name: body.name,
          email: body.email ?? null,
          phone: body.phone ?? null,
          company: body.company ?? null,
          notes: body.notes,
          isActive: body.isActive ?? true,
        },
      });
      res.status(201).json({ data: client });
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const body = parseBody(clientUpdateSchema, req.body);
      const existing = await prisma.client.findUnique({ where: { id } });
      if (!existing) throw new HttpError("Client not found", 404, "not_found");

      const client = await prisma.client.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.company !== undefined ? { company: body.company } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      res.json({ data: client });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = paramId(req);
      const existing = await prisma.client.findUnique({
        where: { id },
        include: { _count: { select: { projects: true, payments: true } } },
      });
      if (!existing) throw new HttpError("Client not found", 404, "not_found");
      if (existing._count.projects > 0 || existing._count.payments > 0) {
        throw new HttpError(
          "Cannot delete client with projects or payments — deactivate instead",
          409,
          "conflict",
        );
      }
      await prisma.client.delete({ where: { id } });
      res.status(204).send();
    }),
  );

  return router;
}
