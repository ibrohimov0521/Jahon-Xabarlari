import { ArticleStatus } from "@prisma/client";
import { Router } from "express";
import slugify from "slugify";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const articleRouter = Router();

const articleSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional(),
  summary: z.string().min(10),
  content: z.string().min(20),
  mainImage: z.string().url().optional().or(z.literal("")),
  gallery: z.array(z.string().url()).optional(),
  categoryId: z.string(),
  status: z.nativeEnum(ArticleStatus).default("DRAFT"),
  isFeatured: z.boolean().default(false),
  isBreaking: z.boolean().default(false),
  isEditorChoice: z.boolean().default(false),
  showOnHome: z.boolean().default(true),
  showInSlider: z.boolean().default(false),
  showInSidebar: z.boolean().default(false),
  showInLatest: z.boolean().default(true),
  showInPopular: z.boolean().default(false),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional()
});

articleRouter.get("/articles", async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const take = Math.min(Number(req.query.limit ?? 12), 50);
  const category = req.query.category?.toString();
  const where = {
    deletedAt: null,
    status: "PUBLISHED" as ArticleStatus,
    ...(category ? { category: { slug: category } } : {})
  };
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: { category: true, author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * take,
      take
    }),
    prisma.article.count({ where })
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
});

articleRouter.get("/articles/:slug", async (req, res) => {
  const article = await prisma.article.update({
    where: { slug: req.params.slug },
    data: { viewsCount: { increment: 1 } },
    include: { category: true, author: { select: { name: true } } }
  }).catch(() => null);
  if (!article || article.deletedAt || article.status !== "PUBLISHED") return res.status(404).json({ message: "Topilmadi" });
  res.json(article);
});

articleRouter.get("/search", async (req, res) => {
  const q = req.query.q?.toString() ?? "";
  const items = await prisma.article.findMany({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
      OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }]
    },
    include: { category: true },
    take: 20
  });
  res.json({ items });
});

articleRouter.get("/admin/articles", requireAuth, permit("articles.read"), async (req, res) => {
  const status = req.query.status?.toString() as ArticleStatus | undefined;
  const items = await prisma.article.findMany({
    where: { ...(status ? { status } : {}) },
    include: { category: true, author: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50
  });
  res.json({ items });
});

articleRouter.post("/admin/articles", requireAuth, permit("articles.create"), async (req, res) => {
  const data = articleSchema.parse(req.body);
  const article = await prisma.article.create({
    data: {
      ...data,
      mainImage: data.mainImage || null,
      gallery: data.gallery ?? [],
      authorId: req.user!.id,
      slug: data.slug || slugify(data.title, { lower: true, strict: true }),
      publishedAt: data.status === "PUBLISHED" ? new Date() : null
    }
  });
  await audit(req, "ARTICLE_CREATE", "Article", article.id, { title: article.title, status: article.status });
  res.status(201).json(article);
});

articleRouter.put("/admin/articles/:id", requireAuth, permit("articles.update"), async (req, res) => {
  const data = articleSchema.partial().parse(req.body);
  const article = await prisma.article.update({ where: { id: req.params.id }, data });
  await audit(req, "ARTICLE_UPDATE", "Article", article.id, data);
  res.json(article);
});

articleRouter.patch("/admin/articles/:id/status", requireAuth, permit("articles.publish"), async (req, res) => {
  const { status } = z.object({ status: z.nativeEnum(ArticleStatus) }).parse(req.body);
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: { status, publishedAt: status === "PUBLISHED" ? new Date() : undefined }
  });
  await audit(req, "ARTICLE_STATUS", "Article", article.id, { status });
  res.json(article);
});

articleRouter.delete("/admin/articles/:id", requireAuth, permit("articles.delete"), async (req, res) => {
  const article = await prisma.article.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
  await audit(req, "ARTICLE_TRASH", "Article", article.id);
  res.json({ ok: true });
});

articleRouter.patch("/admin/articles/:id/restore", requireAuth, permit("articles.delete"), async (req, res) => {
  const article = await prisma.article.update({ where: { id: req.params.id }, data: { deletedAt: null } });
  await audit(req, "ARTICLE_RESTORE", "Article", article.id);
  res.json(article);
});
