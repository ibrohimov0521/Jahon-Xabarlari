import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
// Patches Express 4 so throws/rejections inside async route handlers (e.g. a zod .parse()
// failure) reach the error middleware below instead of hanging the request unanswered.
import "express-async-errors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { apiPort, env, frontendOrigins } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { articleRouter, cleanupOldArticleViews, publishScheduledArticles } from "./modules/articles/routes.js";
import { categoryRouter } from "./modules/categories/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { commentRouter } from "./modules/comments/routes.js";
import { adRouter } from "./modules/ads/routes.js";
import { mediaRouter } from "./modules/media/routes.js";
import { auditRouter } from "./modules/audit/routes.js";
import { userRouter } from "./modules/users/routes.js";
import { aggregatorRouter } from "./modules/aggregator/routes.js";
import { weatherRouter } from "./modules/weather/routes.js";
import { subscriberRouter } from "./modules/subscribers/routes.js";
import { pushRouter } from "./modules/push/routes.js";
import { runAggregatorCycle } from "./services/aggregator.js";
import { closeAggregatorJobs } from "./services/aggregator-jobs.js";
import { prisma } from "./config/prisma.js";
import { closePushJobs } from "./services/push.js";
import { closeTranslationJobs } from "./services/translate.js";
import { closeRedisLockConnection, pingRedis } from "./services/redis.js";
import { logger } from "./services/logger.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  const incoming = req.get("x-request-id");
  const requestId = incoming && /^[a-zA-Z0-9._-]{8,100}$/.test(incoming) ? incoming : crypto.randomUUID();
  const startedAt = performance.now();
  res.set("X-Request-ID", requestId);
  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    if (res.statusCode >= 400 || durationMs >= 1_500) {
      const level = res.statusCode >= 500 ? "error" : "warn";
      logger[level]("http_request", { requestId, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs });
    }
  });
  next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: frontendOrigins, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
// Browser-side API writes still need a broad safety net. Public GET requests are skipped here:
// Next.js server rendering reaches the API from one shared Railway IP, so counting those reads
// together would block every visitor once traffic grows. Expensive public writes have tighter
// route-specific limits below their own routers.
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS"
  })
);

app.get("/api/live", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
});
app.get("/api/health", async (_req, res) => {
  const [database, redis] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, pingRedis()]);
  const ok = database.status === "fulfilled" && redis.status === "fulfilled";
  res.status(ok ? 200 : 503).set("Cache-Control", "no-store").json({
    ok,
    database: database.status === "fulfilled" ? "up" : "down",
    redis: redis.status === "fulfilled" ? "up" : "down",
    uptimeSeconds: Math.round(process.uptime()),
    name: "Jahon Xabarlari API"
  });
});
app.use("/api/auth", authRouter);
app.use("/api", articleRouter);
app.use("/api", categoryRouter);
app.use("/api/admin/dashboard", dashboardRouter);
app.use("/api/admin/comments", commentRouter);
app.use("/api/admin/advertisements", adRouter);
app.use("/api/admin/media", mediaRouter);
app.use("/api/admin/audit-logs", auditRouter);
app.use("/api/admin/users", userRouter);
app.use("/api/admin/aggregator", aggregatorRouter);
app.use("/api/weather", weatherRouter);
app.use("/api/subscribe", subscriberRouter);
app.use("/api/push", pushRouter);

app.use((_req, res) => res.status(404).json({ message: "Topilmadi" }));

// Centralized error handler -- without this, an async route handler that throws (a zod
// validation failure, a Prisma "not found", anything else) would otherwise leak Express's
// default HTML error page (with a full stack trace) straight to the client.
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Kiritilgan ma'lumotlar noto'g'ri", issues: error.issues });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json({ message: "Topilmadi" });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(409).json({ message: "Bu ma'lumot avval yaratilgan" });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return res.status(409).json({ message: "Bog'langan ma'lumot sabab amalni bajarib bo'lmaydi" });
  }
  const requestId = res.getHeader("X-Request-ID")?.toString();
  logger.error("unhandled_request_error", { requestId, method: req.method, path: req.originalUrl, error });
  res.status(500).json({ message: "Serverda kutilmagan xatolik yuz berdi", requestId });
});

const server = app.listen(apiPort, () => {
  console.log(`Jahon Xabarlari API http://localhost:${apiPort}`);
});

const scheduledPublisher = setInterval(() => publishScheduledArticles().catch((error) => console.error("[scheduler] failed:", error)), 60_000);
scheduledPublisher.unref();

async function runMaintenance() {
  const revokedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await Promise.all([
    cleanupOldArticleViews(),
    prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: revokedCutoff } }
        ]
      }
    })
  ]);
}

const maintenanceStartup = setTimeout(() => runMaintenance().catch((error) => console.error("[maintenance] failed:", error)), 30_000);
maintenanceStartup.unref();
const maintenance = setInterval(() => runMaintenance().catch((error) => console.error("[maintenance] failed:", error)), 24 * 60 * 60 * 1000);
maintenance.unref();

let aggregatorStartup: ReturnType<typeof setTimeout> | null = null;
let aggregatorInterval: ReturnType<typeof setInterval> | null = null;
if (env.NEWS_AGGREGATOR_ENABLED) {
  const intervalMs = env.NEWS_AGGREGATOR_INTERVAL_MINUTES * 60_000;
  console.log(`[aggregator] enabled, running every ${env.NEWS_AGGREGATOR_INTERVAL_MINUTES} min`);
  aggregatorStartup = setTimeout(() => runAggregatorCycle().catch((error) => console.error("[aggregator] cycle failed:", error)), 15_000);
  aggregatorStartup.unref();
  aggregatorInterval = setInterval(() => runAggregatorCycle().catch((error) => console.error("[aggregator] cycle failed:", error)), intervalMs);
  aggregatorInterval.unref();
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} qabul qilindi, server to'xtatilmoqda`);
  clearInterval(scheduledPublisher);
  clearTimeout(maintenanceStartup);
  clearInterval(maintenance);
  if (aggregatorStartup) clearTimeout(aggregatorStartup);
  if (aggregatorInterval) clearInterval(aggregatorInterval);
  server.close(() => {
    void (async () => {
      const results = await Promise.allSettled([closeAggregatorJobs(), closePushJobs(), closeTranslationJobs(), closeRedisLockConnection()]);
      results.forEach((result) => {
        if (result.status === "rejected") console.error("[server] servisni yopishda xato:", result.reason);
      });
      await prisma.$disconnect().catch((error) => console.error("[server] Prisma yopilmadi:", error));
      process.exit(0);
    })();
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
