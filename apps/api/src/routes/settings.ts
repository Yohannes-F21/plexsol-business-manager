import { Router } from "express";
import { prisma, type Prisma } from "@plexsol/database";
import {
  settingUpsertSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  asyncHandler,
  HttpError,
  parseBody,
} from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth, requireRole } from "../middleware/auth.js";

const ALLOWED_KEYS = new Set([
  "subscription_reminder_days",
  "subscription_reminder_after_expiration_days",
  "payment_instructions",
  "email_max_attempts",
  "reporting_currency",
]);

export function createSettingsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const items = await prisma.setting.findMany({
        where: { key: { in: [...ALLOWED_KEYS] } },
        orderBy: { key: "asc" },
      });
      res.json({ data: items });
    }),
  );

  router.get(
    "/:key",
    asyncHandler(async (req, res) => {
      const key = String(req.params.key ?? "");
      if (!ALLOWED_KEYS.has(key)) {
        throw new HttpError("Unknown or unsupported setting key", 404, "not_found");
      }
      const item = await prisma.setting.findUnique({ where: { key } });
      if (!item) {
        throw new HttpError("Setting not found", 404, "not_found");
      }
      res.json({ data: item });
    }),
  );

  router.put(
    "/:key",
    requireRole("ADMIN"),
    asyncHandler(async (req, res) => {
      const key = String(req.params.key ?? "");
      if (!ALLOWED_KEYS.has(key)) {
        throw new HttpError("Unknown or unsupported setting key", 404, "not_found");
      }
      const body = parseBody(settingUpsertSchema, { ...req.body, key });
      const value = body.value as Prisma.InputJsonValue;

      const item = await prisma.setting.upsert({
        where: { key },
        update: {
          value,
          description: body.description ?? undefined,
          updatedById: req.user!.id,
        },
        create: {
          key,
          value,
          description: body.description ?? null,
          updatedById: req.user!.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: "UPDATE",
          entityType: "Setting",
          entityId: item.id,
          after: item,
          reason: `Updated setting ${key}`,
        },
      });

      res.json({ data: item });
    }),
  );

  return router;
}
