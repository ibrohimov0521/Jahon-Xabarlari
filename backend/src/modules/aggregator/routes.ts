import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { getAggregatorSources, runAggregatorCycle } from "../../services/aggregator.js";

export const aggregatorRouter = Router();
aggregatorRouter.use(requireAuth, permit("articles.create"));

const sourceSchema = z.object({
  name: z.string().min(2),
  feedUrl: z.string().url(),
  enabled: z.boolean().optional()
});

aggregatorRouter.get("/status", async (_req, res) => {
  const sources = await getAggregatorSources();
  res.json({
    enabled: env.NEWS_AGGREGATOR_ENABLED,
    intervalMinutes: env.NEWS_AGGREGATOR_INTERVAL_MINUTES,
    publishStatus: env.NEWS_AGGREGATOR_STATUS,
    openaiConfigured: Boolean(env.OPENAI_API_KEY),
    sources
  });
});

const SKIP_MESSAGES: Record<string, string> = {
  already_running: "Aggregator allaqachon ishlamoqda, biroz kutib qayta urinib ko'ring",
  disabled: "Aggregator o'chirilgan (NEWS_AGGREGATOR_ENABLED=false)",
  not_configured: "OPENAI_API_KEY sozlanmagan"
};

aggregatorRouter.post("/run", async (req, res) => {
  const maxPerCycle = req.body?.limit ? Number(req.body.limit) : undefined;
  try {
    const result = await runAggregatorCycle({ force: true, maxPerCycle });
    if (result.skipped) {
      return res.json({ ok: false, published: 0, message: SKIP_MESSAGES[result.skipped] });
    }
    res.json({ ok: true, published: result.published, message: `${result.published} ta yangi maqola nashr qilindi` });
  } catch (error) {
    console.error("[aggregator] manual run failed:", error);
    res.status(500).json({ ok: false, published: 0, message: "Aggregator sikli xato bilan tugadi" });
  }
});

aggregatorRouter.post("/sources", async (req, res) => {
  const data = sourceSchema.parse(req.body);
  const source = await prisma.aggregatorSource.create({ data: { ...data, enabled: data.enabled ?? true } });
  res.status(201).json(source);
});

aggregatorRouter.patch("/sources/:id", async (req, res) => {
  const data = sourceSchema.partial().parse(req.body);
  const source = await prisma.aggregatorSource.update({ where: { id: req.params.id }, data });
  res.json(source);
});

aggregatorRouter.delete("/sources/:id", async (req, res) => {
  await prisma.aggregatorSource.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
