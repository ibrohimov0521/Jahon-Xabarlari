import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p urinish qilindi, 15 daqiqadan so'ng qayta urinib ko'ring" }
});

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueTokens(userId: string) {
  const accessToken = jwt.sign({}, env.JWT_ACCESS_SECRET, { subject: userId, expiresIn: "15m" });
  const refreshToken = jwt.sign({}, env.JWT_REFRESH_SECRET, { subject: userId, expiresIn: "30d" });
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) }
  });
  return { accessToken, refreshToken };
}

async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

authRouter.post("/login", loginLimiter, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email }, include: { role: true } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
  }
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role.name }, ...(await issueTokens(user.id)) });
});

authRouter.post("/telegram-login", async (req, res) => {
  const telegramId = z.object({ telegramId: z.string() }).parse(req.body).telegramId;
  const user = await prisma.user.findUnique({ where: { telegramId }, include: { role: true } });
  if (!user) return res.status(403).json({ message: "Telegram ID ruxsat etilmagan" });
  res.json({ user: { id: user.id, name: user.name, role: user.role.name }, ...(await issueTokens(user.id)) });
});

authRouter.post("/refresh", async (req, res) => {
  const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      return res.status(401).json({ message: "Refresh token yaroqsiz" });
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    res.json(await issueTokens(payload.sub));
  } catch {
    res.status(401).json({ message: "Refresh token yaroqsiz" });
  }
});

authRouter.post("/logout", async (req, res) => {
  const token = z.object({ refreshToken: z.string().optional() }).parse(req.body).refreshToken;
  if (token) await revokeRefreshToken(token);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
