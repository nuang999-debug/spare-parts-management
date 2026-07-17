import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { HttpError } from "../../middleware/errorHandler";
import { hashPassword } from "../../lib/password";
import { recordChange } from "../../lib/auditLog";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole("ADMIN"));

const SAFE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

usersRouter.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: SAFE_SELECT, orderBy: { username: "asc" } });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  username: z.string().min(3),
  displayName: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
  tempPassword: z.string().min(8),
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const { username, displayName, role, tempPassword } = createSchema.parse(req.body);
    const changedById = req.user!.id;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new HttpError(409, "Username already exists");

    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { username, displayName, role, passwordHash, mustChangePassword: true },
        select: SAFE_SELECT,
      });
      await recordChange(tx, {
        entityType: "User",
        entityId: String(created.id),
        fieldName: "created",
        oldValue: null,
        newValue: username,
        action: "CREATE",
        changedById,
      });
      return created;
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.string().min(8).optional(),
});

usersRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid id");
    const data = updateSchema.parse(req.body);
    const changedById = req.user!.id;

    if (id === changedById && (data.role === "USER" || data.isActive === false)) {
      throw new HttpError(400, "You cannot remove your own admin role or deactivate your own account");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing) throw new HttpError(404, "User not found");

      const updateData: { role?: "ADMIN" | "USER"; isActive?: boolean; passwordHash?: string; mustChangePassword?: boolean } = {};
      if (data.role !== undefined) updateData.role = data.role;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.resetPassword !== undefined) {
        updateData.passwordHash = await hashPassword(data.resetPassword);
        updateData.mustChangePassword = true;
      }

      const result = await tx.user.update({ where: { id }, data: updateData, select: SAFE_SELECT });

      if (data.role !== undefined && data.role !== existing.role) {
        await recordChange(tx, {
          entityType: "User",
          entityId: String(id),
          fieldName: "role",
          oldValue: existing.role,
          newValue: data.role,
          action: "UPDATE",
          changedById,
        });
      }
      if (data.isActive !== undefined && data.isActive !== existing.isActive) {
        await recordChange(tx, {
          entityType: "User",
          entityId: String(id),
          fieldName: "isActive",
          oldValue: existing.isActive,
          newValue: data.isActive,
          action: "UPDATE",
          changedById,
        });
      }
      if (data.resetPassword !== undefined) {
        await recordChange(tx, {
          entityType: "User",
          entityId: String(id),
          fieldName: "password",
          oldValue: null,
          newValue: null,
          action: "UPDATE",
          changedById,
          note: "Password reset by admin",
        });
      }

      return result;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
