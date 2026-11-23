import type { RequestHandler } from "express";
import { requireRole } from "../middleware/auth.js";

/** Core business modules: only known staff roles may access. */
export const requireBusinessAccess: RequestHandler = requireRole(
  "ADMIN",
  "STAFF",
);
