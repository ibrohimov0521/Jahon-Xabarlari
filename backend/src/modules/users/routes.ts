import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { pagination } from "../../utils/query.js";

export const userRouter = Router();

userRouter.get("/", requireAuth, permit("users.manage"), async (req, res) => {
  const { page, take, skip } = pagination(req.query);
  const [items, total] = await Promise.all([prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    skip,
    take,
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } }
    }
  }), prisma.user.count()]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
});
