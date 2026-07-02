import { AdvertisementStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const adRouter = Router();
adRouter.use(requireAuth, permit("ads.manage"));

adRouter.get("/", async (_req, res) => {
  res.json({ items: await prisma.advertisement.findMany({ orderBy: { updatedAt: "desc" } }) });
});

adRouter.patch("/:id/status", async (req, res) => {
  const status = z.object({ status: z.nativeEnum(AdvertisementStatus) }).parse(req.body).status;
  const item = await prisma.advertisement.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "ADVERTISEMENT_STATUS", "Advertisement", item.id, { status });
  res.json(item);
});
