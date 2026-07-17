import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/password";
import { requireAuth } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";

export const authRouter = Router();

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

    const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;
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
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
