import type { CookieOptions, Request, Response } from "express";
import type { ApiEnv } from "@plexsol/shared";

export function sessionCookieOptions(env: ApiEnv): CookieOptions {
  const maxAgeMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
    /** Signed with SESSION_SECRET via cookie-parser. */
    signed: true,
  };
}

export function setSessionCookie(
  res: Response,
  env: ApiEnv,
  token: string,
): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, sessionCookieOptions(env));
}

export function clearSessionCookie(res: Response, env: ApiEnv): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    ...sessionCookieOptions(env),
    maxAge: 0,
  });
}

export function readSessionToken(req: Request, env: ApiEnv): string | undefined {
  const signed = req.signedCookies?.[env.SESSION_COOKIE_NAME];
  if (typeof signed === "string" && signed.length > 0) {
    return signed;
  }

  // Fallback for unsigned legacy cookies during local transition.
  const unsigned = req.cookies?.[env.SESSION_COOKIE_NAME];
  return typeof unsigned === "string" && unsigned.length > 0
    ? unsigned
    : undefined;
}
