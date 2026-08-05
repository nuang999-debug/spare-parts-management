import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
    // Snapshot of the user's passwordChangedAt at login time, compared against the live DB
    // value on every request (see requireAuth) — lets a password change invalidate every OTHER
    // still-open session immediately, the same way deactivating a user already does.
    passwordChangedAt?: number | null;
  }
}

export {};
