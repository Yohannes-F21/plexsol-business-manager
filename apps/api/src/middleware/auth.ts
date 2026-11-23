import type { NextFunction, Request, Response } from "express";
import type { ApiEnv, PublicUser, UserRole } from "@plexsol/shared";
import { readSessionToken } from "../lib/cookies.js";
import {
  findValidSession,
  toPublicUser,
} from "../services/session-service.js";

export function createRequireAuth(env: ApiEnv) {
  return async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = readSessionToken(req, env);

      if (!token) {
        res.status(401).json({
          error: "unauthorized",
          message: "Authentication required",
        });
        return;
      }

      const session = await findValidSession(token);
      if (!session) {
        res.status(401).json({
          error: "unauthorized",
          message: "Session expired or invalid",
        });
        return;
      }

      req.user = toPublicUser(session.user);
      req.sessionId = session.id;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "unauthorized",
        message: "Authentication required",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "forbidden",
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}

/** Ownership: self or ADMIN may act on a user-owned resource. */
export function assertSelfOrAdmin(
  actor: PublicUser,
  resourceOwnerId: string,
): void {
  if (actor.role === "ADMIN") {
    return;
  }
  if (actor.id !== resourceOwnerId) {
    const error = new Error("You do not own this resource") as Error & {
      status: number;
      code: string;
    };
    error.status = 403;
    error.code = "forbidden";
    throw error;
  }
}
