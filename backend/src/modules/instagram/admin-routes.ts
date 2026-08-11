import { Router } from "express";
import { z } from "zod";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { cancelInstagramDelivery, getInstagramDeliveries, getInstagramSettingsStatus, repairInstagramQueue, type InstagramDeliveryState, testInstagramConnection } from "../../services/instagram.js";

export const instagramAdminRouter = Router();

instagramAdminRouter.use(requireAuth, permit("articles.publish"));

instagramAdminRouter.get("/status", async (_req, res) => {
  res.json(await getInstagramSettingsStatus());
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

instagramAdminRouter.post("/queue/repair", async (req, res) => {
  const result = await repairInstagramQueue();
  await audit(req, "INSTAGRAM_QUEUE_REPAIR", "Instagram", "queue", result);
  res.json({ ok: true, ...result });
});
