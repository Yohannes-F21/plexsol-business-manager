import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "@plexsol/database";
import {
  authSessionResponseSchema,
  loginSchema,
  type ApiEnv,
} from "@plexsol/shared";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "../lib/cookies.js";
import { verifyPassword } from "../lib/password.js";
import { LoginRateLimiter } from "../lib/rate-limit.js";
import { createRequireAuth } from "../middleware/auth.js";
import {
  createUserSession,
  destroySession,
  destroySessionByToken,
  toPublicUser,
} from "../services/session-service.js";

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || "unknown";
}

export function createAuthRouter(env: ApiEnv): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env);
  const rateLimiter = new LoginRateLimiter(
    env.LOGIN_RATE_LIMIT_MAX,
    env.LOGIN_RATE_LIMIT_WINDOW_MS,
  );

  router.post(
    "/login",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "validation_error",
            message: "Invalid login payload",
            details: parsed.error.flatten(),
          });
          return;
        }

        const { email, password } = parsed.data;
        const ip = clientIp(req);
        const rate = rateLimiter.check(ip, email);

        if (!rate.allowed) {
          res.setHeader(
            "Retry-After",
            String(Math.ceil(rate.retryAfterMs / 1000)),
          );
          res.status(429).json({
            error: "rate_limited",
            message: "Too many login attempts. Try again later.",
          });
          return;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        const valid =
          user &&
          user.isActive &&
          (await verifyPassword(user.passwordHash, password));

        if (!valid || !user) {
          rateLimiter.recordFailure(ip, email);
          res.status(401).json({
            error: "invalid_credentials",
            message: "Invalid email or password",
          });
          return;
        }

        rateLimiter.reset(ip, email);

        const { token } = await createUserSession({
          userId: user.id,
          ttlHours: env.SESSION_TTL_HOURS,
          ipAddress: ip,
          userAgent: req.get("user-agent") ?? undefined,
        });

        setSessionCookie(res, env, token);

        const payload = authSessionResponseSchema.parse({
          user: toPublicUser(user),
        });

        res.status(200).json(payload);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/logout",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = readSessionToken(req, env);

        if (req.sessionId) {
          await destroySession(req.sessionId);
        } else if (token) {
          await destroySessionByToken(token);
        }

        clearSessionCookie(res, env);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/me",
    requireAuth,
    (req: Request, res: Response) => {
      const payload = authSessionResponseSchema.parse({ user: req.user });
      res.status(200).json(payload);
    },
  );

  return router;
}
