import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function issueTokens(userId: string) {
  return {
    accessToken: jwt.sign({}, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: "15m" }),
    refreshToken: jwt.sign({}, env.JWT_REFRESH_SECRET, { subject: userId, expiresIn: "30d" })
  };
}

authRouter.post("/login", async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email }, include: { role: true } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
  }
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role.name }, ...issueTokens(user.id) });
});

authRouter.post("/telegram-login", async (req, res) => {
  const telegramId = z.object({ telegramId: z.string() }).parse(req.body).telegramId;
  const user = await prisma.user.findUnique({ where: { telegramId }, include: { role: true } });
  if (!user) return res.status(403).json({ message: "Telegram ID ruxsat etilmagan" });
  res.json({ user: { id: user.id, name: user.name, role: user.role.name }, ...issueTokens(user.id) });
});

authRouter.post("/refresh", async (req, res) => {
  const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
    res.json(issueTokens(payload.sub));
  } catch {
    res.status(401).json({ message: "Refresh token yaroqsiz" });
  }
});

authRouter.post("/logout", (_req, res) => res.json({ ok: true }));

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
