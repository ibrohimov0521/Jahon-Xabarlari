import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { Router, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import { env, frontendOrigins } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  openTotpSecret,
  resolveTotpSetupSecret,
  sealTotpSecret,
  totpUri,
  verifyTotp
} from "../../services/totp.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  otp: z.string().trim().max(32).optional()
});
const refreshBodySchema = z.object({ refreshToken: z.string().max(4_096).optional() });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(12).max(128)
    .regex(/[a-z]/, "Yangi parolda kichik harf bo'lishi kerak")
    .regex(/[A-Z]/, "Yangi parolda katta harf bo'lishi kerak")
    .regex(/\d/, "Yangi parolda raqam bo'lishi kerak"),
  code: z.string().trim().max(32).optional()
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

const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Tasdiqlash urinishlari ko'payib ketdi. Keyinroq qayta urinib ko'ring" }
});

const accountSecurityLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Xavfsizlik amallari ko'payib ketdi. Keyinroq qayta urinib ko'ring" }
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
  // A jti keeps two logins in the same second from producing the same tokenHash.
  const refreshToken = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: "30d",
    jwtid: crypto.randomUUID()
  });
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) }
  });
  return { accessToken, refreshToken };
}

async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

async function verifySecondFactor(user: { id: string; twoFactorSecret: string | null; twoFactorRecoveryHashes: string[] }, code: string) {
  if (!user.twoFactorSecret) return false;
  let secret: string;
  try {
    secret = openTotpSecret(user.twoFactorSecret, env.JWT_REFRESH_SECRET);
  } catch {
    return false;
  }
  if (verifyTotp(secret, code)) return true;

  const candidate = hashRecoveryCode(code, env.JWT_REFRESH_SECRET);
  const matched = user.twoFactorRecoveryHashes.find((hash) => safeEqual(hash, candidate));
  if (!matched) return false;
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorRecoveryHashes: user.twoFactorRecoveryHashes.filter((hash) => hash !== matched) }
  });
  return true;
}

authRouter.post("/login", loginLimiter, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email }, include: { role: true } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
  }
  if (user.twoFactorEnabled) {
    if (!data.otp) return res.status(202).json({ requiresTwoFactor: true });
    if (!(await verifySecondFactor(user, data.otp))) {
      return res.status(401).json({ message: "Tasdiqlash kodi noto'g'ri" });
    }
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
  const telegramId = z.object({ telegramId: z.string().regex(/^\d{5,20}$/) }).parse(req.body).telegramId;
  const user = await prisma.user.findUnique({ where: { telegramId }, include: { role: true } });
  if (!user) return res.status(403).json({ message: "Telegram ID ruxsat etilmagan" });
  const { accessToken, refreshToken } = await issueTokens(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.json({ user: { id: user.id, name: user.name, role: user.role.name }, accessToken });
});

authRouter.post("/refresh", requireTrustedOrigin, async (req, res) => {
  // Prefer the HttpOnly cookie; fall back to a body token so any pre-migration client still works.
  const token = req.cookies?.[REFRESH_COOKIE] ?? refreshBodySchema.parse(req.body ?? {}).refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token yaroqsiz" });
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      return res.status(401).json({ message: "Refresh token yaroqsiz" });
    }
    const rotated = await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    if (rotated.count !== 1) return res.status(401).json({ message: "Refresh token avval ishlatilgan" });
    const { accessToken, refreshToken } = await issueTokens(payload.sub);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: "Refresh token yaroqsiz" });
  }
});

authRouter.post("/logout", requireTrustedOrigin, async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] ?? refreshBodySchema.parse(req.body ?? {}).refreshToken;
  if (token) await revokeRefreshToken(token);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

authRouter.get("/2fa/status", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { twoFactorEnabled: true, twoFactorSecret: true, twoFactorRecoveryHashes: true }
  });
  res.json({
    enabled: user.twoFactorEnabled,
    setupPending: Boolean(user.twoFactorSecret && !user.twoFactorEnabled),
    recoveryCodesRemaining: user.twoFactorRecoveryHashes.length
  });
});

authRouter.post("/2fa/setup", twoFactorLimiter, requireAuth, async (req, res) => {
  const { password } = z.object({ password: z.string().min(8).max(128) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { email: true, passwordHash: true, twoFactorEnabled: true, twoFactorSecret: true }
  });
  if (user.twoFactorEnabled) return res.status(409).json({ message: "Ikki bosqichli himoya allaqachon yoqilgan" });
  if (!(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Joriy parol noto'g'ri" });
  const { secret, resumed } = resolveTotpSetupSecret(user.twoFactorSecret, env.JWT_REFRESH_SECRET);
  if (!resumed) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user!.id },
        data: { twoFactorSecret: sealTotpSecret(secret, env.JWT_REFRESH_SECRET), twoFactorRecoveryHashes: [] }
      }),
      prisma.auditLog.create({ data: { userId: req.user!.id, action: "AUTH_2FA_SETUP_STARTED", entity: "User", entityId: req.user!.id, ip: req.ip } })
    ]);
  }
  res.json({ secret, uri: totpUri(secret, user.email), resumed });
});

authRouter.post("/2fa/enable", twoFactorLimiter, requireAuth, async (req, res) => {
  const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { twoFactorSecret: true } });
  if (!user.twoFactorSecret) return res.status(409).json({ message: "Avval 2FA sozlashni boshlang" });
  let secret: string;
  try {
    secret = openTotpSecret(user.twoFactorSecret, env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(409).json({ message: "2FA sozlamasi eskirgan. Qayta sozlang" });
  }
  if (!verifyTotp(secret, code)) return res.status(400).json({ message: "Tasdiqlash kodi noto'g'ri" });
  const recoveryCodes = generateRecoveryCodes();
  await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      twoFactorEnabled: true,
      twoFactorRecoveryHashes: recoveryCodes.map((item) => hashRecoveryCode(item, env.JWT_REFRESH_SECRET))
    }
  });
  await prisma.auditLog.create({ data: { userId: req.user!.id, action: "AUTH_2FA_ENABLED", entity: "User", entityId: req.user!.id, ip: req.ip } });
  res.json({ enabled: true, recoveryCodes });
});

authRouter.post("/2fa/disable", twoFactorLimiter, requireAuth, async (req, res) => {
  const { password, code } = z.object({ password: z.string().min(8).max(128), code: z.string().trim().max(32) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { id: true, passwordHash: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorRecoveryHashes: true }
  });
  if (!user.twoFactorEnabled) return res.status(409).json({ message: "Ikki bosqichli himoya yoqilmagan" });
  if (!(await bcrypt.compare(password, user.passwordHash)) || !(await verifySecondFactor(user, code))) {
    return res.status(401).json({ message: "Parol yoki tasdiqlash kodi noto'g'ri" });
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryHashes: [] }
    }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { userId: user.id, action: "AUTH_2FA_DISABLED", entity: "User", entityId: user.id, ip: req.ip } })
  ]);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ enabled: false, reauthenticate: true });
});

authRouter.post("/password/change", accountSecurityLimiter, requireTrustedOrigin, requireAuth, async (req, res) => {
  const data = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { id: true, passwordHash: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorRecoveryHashes: true }
  });
  if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
    return res.status(401).json({ message: "Joriy parol noto'g'ri" });
  }
  if (await bcrypt.compare(data.newPassword, user.passwordHash)) {
    return res.status(409).json({ message: "Yangi parol joriy paroldan farq qilishi kerak" });
  }
  if (user.twoFactorEnabled && (!data.code || !(await verifySecondFactor(user, data.code)))) {
    return res.status(401).json({ message: "Authenticator yoki tiklash kodi noto'g'ri" });
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { userId: user.id, action: "AUTH_PASSWORD_CHANGED", entity: "User", entityId: user.id, ip: req.ip } })
  ]);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ changed: true, reauthenticate: true });
});
