import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const userRouter = Router();

userRouter.get("/", requireAuth, permit("users.manage"), async (_req, res) => {
  const items = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      telegramId: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } }
    }
  });
  res.json({ items });
});
