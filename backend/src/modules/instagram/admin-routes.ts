import { Router } from "express";
import { z } from "zod";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { cancelInstagramDeliveries, cancelInstagramDelivery, getInstagramAggregatorSources, getInstagramAutoPublishEnabled, getInstagramDeliveries, getInstagramSettingsStatus, prioritizeInstagramDeliveries, repairInstagramQueue, setInstagramAggregatorSourceEnabled, setInstagramAutoPublishEnabled, type InstagramDeliveryState, testInstagramConnection } from "../../services/instagram.js";

export const instagramAdminRouter = Router();

instagramAdminRouter.use(requireAuth, permit("articles.publish"));

instagramAdminRouter.get("/status", async (_req, res) => {
  res.json(await getInstagramSettingsStatus());
});

instagramAdminRouter.patch("/settings", async (req, res) => {
  const { autoPublishEnabled } = z.object({ autoPublishEnabled: z.boolean() }).parse(req.body);
  const previousValue = await getInstagramAutoPublishEnabled();
  const savedValue = await setInstagramAutoPublishEnabled(autoPublishEnabled);
  await audit(req, "INSTAGRAM_SETTINGS_UPDATE", "Setting", "instagram.autoPublishEnabled", {
    previousValue,
    autoPublishEnabled: savedValue
  });
  res.json({
    autoPublishEnabled: savedValue,
    message: savedValue
      ? "Instagramga avtomatik yuborish davom ettirildi"
      : "Avtomatik yuborish to'xtatildi. Yangi postlar navbatda saqlanadi"
  });
});

instagramAdminRouter.get("/sources", async (_req, res) => {
  res.json({ items: await getInstagramAggregatorSources() });
});

instagramAdminRouter.patch("/sources/:id", async (req, res) => {
  const id = z.string().min(1).max(64).parse(req.params.id);
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  const result = await setInstagramAggregatorSourceEnabled(id, enabled);
  await audit(req, "INSTAGRAM_SOURCE_UPDATE", "AggregatorSource", id, {
    enabled,
    affectedArticles: result.affected,
    removedJobs: result.removedJobs
  });
  res.json({
    ...result,
    message: enabled
      ? `${result.source.name} Instagram uchun yoqildi`
      : `${result.source.name} Instagram uchun o'chirildi. ${result.affected} ta navbatdagi post bekor qilindi`
  });
});

instagramAdminRouter.get("/deliveries", async (req, res) => {
  const state = req.query.state;
  if (state !== "sent" && state !== "queued" && state !== "failed") {
    return res.status(400).json({ message: "Noto'g'ri Instagram xabar holati" });
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json(await getInstagramDeliveries(state as InstagramDeliveryState, page));
});

instagramAdminRouter.post("/test-connection", async (req, res) => {
  const result = await testInstagramConnection();
  await audit(req, "INSTAGRAM_CONNECTION_TEST", "Instagram", "connection", { ok: result.ok });
  res.status(result.ok ? 200 : 422).json(result);
});

instagramAdminRouter.post("/deliveries/:id/cancel", async (req, res) => {
  const id = z.string().min(1).max(64).parse(req.params.id);
  const result = await cancelInstagramDelivery(id);
  await audit(req, "ARTICLE_INSTAGRAM_CANCEL", "Article", id, result);
  res.json({ ok: true, message: "Maqola Instagram navbatidan olib tashlandi", ...result });
});

instagramAdminRouter.post("/deliveries/bulk", async (req, res) => {
  const { ids, action } = z.object({
    ids: z.array(z.string().min(1).max(64)).min(1).max(100),
    action: z.enum(["prioritize", "cancel"])
  }).parse(req.body);
  const result = action === "prioritize"
    ? await prioritizeInstagramDeliveries(ids)
    : await cancelInstagramDeliveries(ids);
  await audit(req, action === "prioritize" ? "ARTICLE_INSTAGRAM_BULK_RETRY" : "ARTICLE_INSTAGRAM_BULK_CANCEL", "Instagram", "deliveries", { ids, ...result });
  res.json({
    ok: true,
    message: action === "prioritize"
      ? `${result.affected} ta post tezkor navbatga olindi`
      : `${result.affected} ta post Instagram navbatidan olib tashlandi`,
    ...result
  });
});

instagramAdminRouter.post("/queue/repair", async (req, res) => {
  const result = await repairInstagramQueue();
  await audit(req, "INSTAGRAM_QUEUE_REPAIR", "Instagram", "queue", result);
  res.json({ ok: true, ...result });
});
