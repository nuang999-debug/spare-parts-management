import { RequestHandler } from "express";
import { prisma } from "../db";
import { HttpError } from "./errorHandler";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    next(new HttpError(401, "Not authenticated"));
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    next(new HttpError(401, "Session invalid"));
    return;
  }
  // A password change (self-service or admin reset) stamps passwordChangedAt — any session
  // whose snapshot predates that stamp was issued under the old password and must die here,
  // otherwise a stolen cookie stays valid indefinitely even after the owner "changes it."
  const currentStamp = user.passwordChangedAt?.getTime() ?? null;
  if (currentStamp !== null && req.session.passwordChangedAt !== currentStamp) {
    req.session.destroy(() => {});
    next(new HttpError(401, "Session invalid"));
    return;
  }
  // mustChangePassword (set on account creation and admin-triggered resets) previously only
  // steered the frontend's own routing (AppShell redirects to /change-password) — nothing
  // stopped a client that skips the UI from calling any other endpoint directly with the
  // still-valid temporary password. /me stays open so the frontend can even learn the flag is
  // set, and /change-password obviously has to stay open to let the user actually clear it.
  const isPasswordChangeExempt = req.baseUrl === "/api/auth" && (req.path === "/me" || req.path === "/change-password");
  if (user.mustChangePassword && !isPasswordChangeExempt) {
    next(new HttpError(403, "Password change required before continuing"));
    return;
  }

  req.user = user;
  next();
};
