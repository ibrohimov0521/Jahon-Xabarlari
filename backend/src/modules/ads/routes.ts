import { AdvertisementStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const adRouter = Router();
adRouter.use(requireAuth, permit("ads.manage"));

const adSchema = z.object({
  title: z.string().min(2),
  placement: z.string().min(2),
  imageUrl: z.string().url().optional().or(z.literal("")),
  targetUrl: z.string().url().optional().or(z.literal("")),
  status: z.nativeEnum(AdvertisementStatus).default("DRAFT")
});

adRouter.get("/", async (_req, res) => {
  res.json({ items: await prisma.advertisement.findMany({ orderBy: { updatedAt: "desc" } }) });
});

adRouter.post("/", async (req, res) => {
  const data = adSchema.parse(req.body);
  const item = await prisma.advertisement.create({
    data: { ...data, imageUrl: data.imageUrl || null, targetUrl: data.targetUrl || null }
  });
  await audit(req, "ADVERTISEMENT_CREATE", "Advertisement", item.id, { title: item.title });
  res.status(201).json(item);
});

adRouter.put("/:id", async (req, res) => {
  const data = adSchema.partial().parse(req.body);
  const item = await prisma.advertisement.update({
    where: { id: req.params.id },
    data: { ...data, imageUrl: data.imageUrl || undefined, targetUrl: data.targetUrl || undefined }
  });
  await audit(req, "ADVERTISEMENT_UPDATE", "Advertisement", item.id, data);
  res.json(item);
});

adRouter.patch("/:id/status", async (req, res) => {
  const status = z.object({ status: z.nativeEnum(AdvertisementStatus) }).parse(req.body).status;
  const item = await prisma.advertisement.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "ADVERTISEMENT_STATUS", "Advertisement", item.id, { status });
  res.json(item);
});

adRouter.delete("/:id", async (req, res) => {
  await prisma.advertisement.delete({ where: { id: req.params.id } });
  await audit(req, "ADVERTISEMENT_DELETE", "Advertisement", req.params.id);
  res.json({ ok: true });
});
