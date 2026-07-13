import { Router } from "express";
import slugify from "slugify";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const categoryRouter = Router();

categoryRouter.get("/categories", async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
});

categoryRouter.post("/admin/categories", requireAuth, permit("categories.manage"), async (req, res) => {
  const name = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body).name;
  const item = await prisma.category.create({ data: { name, slug: slugify(name, { lower: true, strict: true }) } });
  await audit(req, "CATEGORY_CREATE", "Category", item.id);
  res.status(201).json(item);
});

categoryRouter.put("/admin/categories/:id", requireAuth, permit("categories.manage"), async (req, res) => {
  const name = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body).name;
  const item = await prisma.category.update({ where: { id: req.params.id }, data: { name } });
  await audit(req, "CATEGORY_UPDATE", "Category", item.id);
  res.json(item);
});

categoryRouter.delete("/admin/categories/:id", requireAuth, permit("categories.manage"), async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  await audit(req, "CATEGORY_DELETE", "Category", req.params.id);
  res.json({ ok: true });
});
