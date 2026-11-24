import { Router } from "express";
import { getClientOutstandingBalances, prisma } from "@plexsol/database";
import type { ApiEnv } from "@plexsol/shared";
import { asyncHandler, HttpError, paramId } from "../lib/http.js";
import { requireBusinessAccess } from "../lib/roles.js";
import { createRequireAuth } from "../middleware/auth.js";

export function createBalancesRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(createRequireAuth(env));
  router.use(requireBusinessAccess);

  router.get(
    "/clients/:id",
    asyncHandler(async (req, res) => {
      const clientId = paramId(req);
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw new HttpError("Client not found", 404, "not_found");

      const balances = await getClientOutstandingBalances(prisma, clientId);
      res.json({ data: balances });
    }),
  );

  return router;
}
