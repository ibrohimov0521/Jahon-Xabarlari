import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { getAggregatorJobCounts, queueAggregatorRun } from "../../services/aggregator-jobs.js";
import { getAggregatorSources, MAX_AGGREGATOR_SOURCES } from "../../services/aggregator.js";
import { assertPublicUrl } from "../../services/net-guard.js";

export const aggregatorRouter = Router();
aggregatorRouter.use(requireAuth, permit("articles.create"));

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  feedUrl: z.string().url().max(2_048),
  enabled: z.boolean().optional()
});
const runSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() });

aggregatorRouter.get("/status", async (_req, res) => {
  const [sources, jobs] = await Promise.all([getAggregatorSources(), getAggregatorJobCounts()]);
  res.json({
    enabled: env.NEWS_AGGREGATOR_ENABLED,
    intervalMinutes: env.NEWS_AGGREGATOR_INTERVAL_MINUTES,
    publishStatus: env.NEWS_AGGREGATOR_STATUS,
    autoPublishEnabled: env.NEWS_AGGREGATOR_AUTO_PUBLISH,
    openaiConfigured: Boolean(env.OPENAI_API_KEY),
    sources,
    jobs
  });
});

const ALREADY_RUNNING_MESSAGE = "Aggregator allaqachon ishlamoqda, biroz kutib qayta urinib ko'ring";

aggregatorRouter.post("/run", async (req, res) => {
  const maxPerCycle = runSchema.parse(req.body ?? {}).limit;
  try {
    const job = await queueAggregatorRun(maxPerCycle);
    if (!job) return res.json({ ok: false, published: 0, message: ALREADY_RUNNING_MESSAGE });
    await audit(req, "AGGREGATOR_RUN_QUEUED", "AggregatorJob", job.id, { maxPerCycle });
    res.status(202).json({ ok: true, published: 0, jobId: job.id, message: "Aggregator navbatga olindi va fonda ishlaydi" });
  } catch (error) {
    console.error("[aggregator] manual run failed:", error);
    res.status(500).json({ ok: false, published: 0, message: "Aggregator sikli xato bilan tugadi" });
  }
});

aggregatorRouter.post("/sources", async (req, res) => {
  const data = sourceSchema.parse(req.body);
  if ((await prisma.aggregatorSource.count()) >= MAX_AGGREGATOR_SOURCES) {
    return res.status(409).json({ message: `Ko'pi bilan ${MAX_AGGREGATOR_SOURCES} ta aggregator manbasi qo'shish mumkin` });
  }
  try {
    await assertPublicUrl(data.feedUrl);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Feed URL yaroqsiz" });
  }
  const source = await prisma.aggregatorSource.create({ data: { ...data, enabled: data.enabled ?? true } });
  await audit(req, "AGGREGATOR_SOURCE_CREATE", "AggregatorSource", source.id, { name: source.name, feedUrl: source.feedUrl });
  res.status(201).json(source);
});

aggregatorRouter.patch("/sources/:id", async (req, res) => {
  const data = sourceSchema.partial().parse(req.body);
  if (data.feedUrl) {
    try {
      await assertPublicUrl(data.feedUrl);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Feed URL yaroqsiz" });
    }
  }
  const source = await prisma.aggregatorSource.update({ where: { id: req.params.id }, data });
  await audit(req, "AGGREGATOR_SOURCE_UPDATE", "AggregatorSource", source.id, data);
  res.json(source);
});

aggregatorRouter.delete("/sources/:id", async (req, res) => {
  await prisma.aggregatorSource.delete({ where: { id: req.params.id } });
  await audit(req, "AGGREGATOR_SOURCE_DELETE", "AggregatorSource", req.params.id);
  res.json({ ok: true });
});
