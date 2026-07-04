import { Router } from "express";
import { env } from "../../config/env.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { NEWS_SOURCES, runAggregatorCycle } from "../../services/aggregator.js";

export const aggregatorRouter = Router();
aggregatorRouter.use(requireAuth, permit("articles.create"));

aggregatorRouter.get("/status", (_req, res) => {
  res.json({
    enabled: env.NEWS_AGGREGATOR_ENABLED,
    intervalMinutes: env.NEWS_AGGREGATOR_INTERVAL_MINUTES,
    publishStatus: env.NEWS_AGGREGATOR_STATUS,
    anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY),
    sources: NEWS_SOURCES.map((source) => source.name)
  });
});

aggregatorRouter.post("/run", (req, res) => {
  const maxPerCycle = req.body?.limit ? Number(req.body.limit) : undefined;
  runAggregatorCycle({ force: true, maxPerCycle }).catch((error) => console.error("[aggregator] manual run failed:", error));
  res.json({ ok: true, message: "Aggregator sikli ishga tushirildi" });
});
