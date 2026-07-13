import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { Router, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import { env, frontendOrigins } from "../../config/env.js";
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

// telegram-login is a server-to-server call from the bot; a tighter limit blocks id brute-forcing.
const telegramLoginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p urinish qilindi, keyinroq urinib ko'ring" }
});

// Constant-time compare so a mismatched bot secret can't be recovered by timing the response.
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = "refreshToken";
const isProd = process.env.NODE_ENV === "production";

// The refresh token is long-lived (30d), so it must never be readable by JS. Delivered as an
// HttpOnly cookie scoped to /api/auth. Cross-site (frontend and API are separate Railway hosts)
// requires SameSite=None + Secure in production; localhost dev falls back to Lax over http.
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/api/auth",
    maxAge: REFRESH_TTL_MS
  };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && !frontendOrigins.includes(origin)) return res.status(403).json({ message: "Origin ruxsat etilmagan" });
  next();
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
  const { accessToken, refreshToken } = await issueTokens(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role.name }, accessToken });
});

authRouter.post("/telegram-login", telegramLoginLimiter, async (req, res) => {
  // Telegram numeric ids are not secret (they leak via forwarded messages, @userinfobot, group
  // member lists). Without a shared secret, anyone who submits a linked admin's id would get
  // tokens. Require the bot's X-Bot-Secret and fail closed if the secret isn't configured.
  if (!env.BOT_SERVICE_SECRET) {
    return res.status(503).json({ message: "Telegram login sozlanmagan" });
  }
  const provided = req.header("x-bot-secret") ?? "";
  if (!safeEqual(provided, env.BOT_SERVICE_SECRET)) {
    return res.status(401).json({ message: "Ruxsat yo'q" });
  }
  const telegramId = z.object({ telegramId: z.string() }).parse(req.body).telegramId;
  const user = await prisma.user.findUnique({ where: { telegramId }, include: { role: true } });
  if (!user) return res.status(403).json({ message: "Telegram ID ruxsat etilmagan" });
  const { accessToken, refreshToken } = await issueTokens(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ user: { id: user.id, name: user.name, role: user.role.name }, accessToken });
});

authRouter.post("/refresh", requireTrustedOrigin, async (req, res) => {
  // Prefer the HttpOnly cookie; fall back to a body token so any pre-migration client still works.
  const token = req.cookies?.[REFRESH_COOKIE] ?? z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {}).refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token yaroqsiz" });
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      return res.status(401).json({ message: "Refresh token yaroqsiz" });
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const { accessToken, refreshToken } = await issueTokens(payload.sub);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: "Refresh token yaroqsiz" });
  }
});

authRouter.post("/logout", requireTrustedOrigin, async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] ?? z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {}).refreshToken;
  if (token) await revokeRefreshToken(token);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
