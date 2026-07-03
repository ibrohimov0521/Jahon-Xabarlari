import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { apiPort, env } from "./config/env.js";
import { authRouter } from "./modules/auth/routes.js";
import { articleRouter } from "./modules/articles/routes.js";
import { categoryRouter } from "./modules/categories/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { commentRouter } from "./modules/comments/routes.js";
import { adRouter } from "./modules/ads/routes.js";
import { mediaRouter } from "./modules/media/routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
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

app.listen(apiPort, () => {
  console.log(`Jahon Xabarlari API http://localhost:${apiPort}`);
});
