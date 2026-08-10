import { Router } from "express";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { getInstagramSettingsStatus, testInstagramConnection } from "../../services/instagram.js";

export const instagramAdminRouter = Router();

instagramAdminRouter.use(requireAuth, permit("articles.publish"));

instagramAdminRouter.get("/status", async (_req, res) => {
  res.json(await getInstagramSettingsStatus());
});

instagramAdminRouter.post("/test-connection", async (req, res) => {
  const result = await testInstagramConnection();
  await audit(req, "INSTAGRAM_CONNECTION_TEST", "Instagram", "connection", { ok: result.ok });
  res.status(result.ok ? 200 : 422).json(result);
});
