import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { requireAuth } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";

export const authRouter = Router();

// A bcrypt.compare against a real hash takes ~50-100ms; skipping it entirely when the username
// doesn't exist made that request return almost instantly, letting an attacker enumerate valid
// usernames purely from response timing even though the error message itself never differs.
// Comparing against this hash (of an arbitrary, unrelated string) whenever there's no real user
// keeps the cost — and therefore the timing — the same on both paths.
const DUMMY_HASH = "$2b$12$QHKj7AdoGPtBEnwYiw6dEe.ZEnV6q375B8LoM14WDIpKA2LJYsZl2";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function toSafeUser(user: {
  id: number;
  username: string;
  displayName: string;
  role: string;
  mustChangePassword: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

async function recordLogin(params: {
  userId: number | null;
  usernameAttempted: string;
  success: boolean;
  ipAddress: string | undefined;
  userAgent: string | undefined;
}) {
  await prisma.loginHistory.create({
    data: {
      userId: params.userId,
      usernameAttempted: params.usernameAttempted,
      success: params.success,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });

    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    const success = Boolean(user && user.isActive && passwordOk);

    await recordLogin({
      userId: user?.id ?? null,
      usernameAttempted: username,
      success,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    if (!success || !user) {
      throw new HttpError(401, "Invalid username or password");
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user.id;
    req.session.passwordChangedAt = user.passwordChangedAt?.getTime() ?? null;

    res.json(toSafeUser(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(toSafeUser(req.user!));
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = req.user!;
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, "Current password is incorrect");
    }
    if (currentPassword === newPassword) {
      throw new HttpError(400, "New password must be different from the current password");
    }
    const passwordHash = await hashPassword(newPassword);
    const passwordChangedAt = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt },
    });
    // Every OTHER open session for this user now fails requireAuth's stamp check on its next
    // request — but THIS session must keep working (the user is still using it right now), so
    // its own snapshot needs to move forward to match what was just written.
    req.session.passwordChangedAt = passwordChangedAt.getTime();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
