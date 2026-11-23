import { Router, type NextFunction, type Request, type Response } from "express";
import type { ApiEnv } from "@plexsol/shared";
import {
  assertSelfOrAdmin,
  createRequireAuth,
  requireRole,
} from "../middleware/auth.js";

/**
 * Minimal protected routes to prove auth gates in Phase 3.
 * Domain CRUD arrives in later phases.
 */
export function createProtectedDemoRouter(env: ApiEnv): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env);

  router.get("/ping", requireAuth, (req: Request, res: Response) => {
    res.status(200).json({
      data: {
        ok: true,
        userId: req.user?.id,
        role: req.user?.role,
      },
    });
  });

  router.get(
    "/admin-ping",
    requireAuth,
    requireRole("ADMIN"),
    (req: Request, res: Response) => {
      res.status(200).json({
        data: {
          ok: true,
          admin: true,
          userId: req.user?.id,
        },
      });
    },
  );

  /**
   * Ownership demo: STAFF may only access their own user id; ADMIN may access any.
   */
  router.get(
    "/users/:userId/profile",
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const rawUserId = req.params.userId;
        const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        if (!userId || !req.user) {
          res.status(400).json({
            error: "validation_error",
            message: "userId is required",
          });
          return;
        }

        assertSelfOrAdmin(req.user, userId);

        res.status(200).json({
          data: {
            userId,
            viewerId: req.user.id,
            viewerRole: req.user.role,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
