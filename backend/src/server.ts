import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
// Patches Express 4 so throws/rejections inside async route handlers (e.g. a zod .parse()
// failure) reach the error middleware below instead of hanging the request unanswered.
import "express-async-errors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { apiPort, env, frontendOrigins } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { articleRouter, publishScheduledArticles } from "./modules/articles/routes.js";
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
import { runAggregatorCycle } from "./services/aggregator.js";

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: frontendOrigins, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 180 }));

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Jahon Xabarlari API" }));
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

app.use((req, res) => res.status(404).json({ message: "Topilmadi" }));

// Centralized error handler -- without this, an async route handler that throws (a zod
// validation failure, a Prisma "not found", anything else) would otherwise leak Express's
// default HTML error page (with a full stack trace) straight to the client.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Kiritilgan ma'lumotlar noto'g'ri", issues: error.issues });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return res.status(404).json({ message: "Topilmadi" });
  }
  console.error("[server] Kutilmagan xatolik:", error);
  res.status(500).json({ message: "Serverda kutilmagan xatolik yuz berdi" });
});

app.listen(apiPort, () => {
  console.log(`Jahon Xabarlari API http://localhost:${apiPort}`);
});

setInterval(() => publishScheduledArticles().catch((error) => console.error("[scheduler] failed:", error)), 60_000);

if (env.NEWS_AGGREGATOR_ENABLED) {
  const intervalMs = env.NEWS_AGGREGATOR_INTERVAL_MINUTES * 60_000;
  console.log(`[aggregator] enabled, running every ${env.NEWS_AGGREGATOR_INTERVAL_MINUTES} min`);
  setTimeout(() => runAggregatorCycle().catch((error) => console.error("[aggregator] cycle failed:", error)), 15_000);
  setInterval(() => runAggregatorCycle().catch((error) => console.error("[aggregator] cycle failed:", error)), intervalMs);
}
