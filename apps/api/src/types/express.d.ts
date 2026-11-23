import type { PublicUser } from "@plexsol/shared";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionId?: string;
    }
  }
}

export {};
