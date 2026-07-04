import { ArticleStatus } from "@prisma/client";
import { Router } from "express";
import slugify from "slugify";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { LANGS, queueTranslations, regenerateTranslation, type Lang } from "../../services/translate.js";

export const articleRouter = Router();

const articleSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional(),
  summary: z.string().min(10),
  content: z.string().min(20),
  mainImage: z.string().url().optional().or(z.literal("")),
  gallery: z.array(z.string().url()).optional(),
  categoryId: z.string(),
  extraCategoryIds: z.array(z.string()).optional(),
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

const idsSchema = z.object({ ids: z.array(z.string()).min(1) });

function isLang(value: string | undefined): value is Lang {
  return !!value && (LANGS as readonly string[]).includes(value);
}

function applyTranslation<T extends { title: string; summary: string; content: string; seoTitle: string | null; seoDescription: string | null }>(
  article: T & { translations?: { lang: string; title: string; summary: string; content: string; seoTitle: string | null; seoDescription: string | null; status: string }[] },
  lang?: string
) {
  if (!isLang(lang)) return article;
  const translation = article.translations?.find((item) => item.lang === lang && item.status === "READY");
  if (!translation) return article;
  return {
    ...article,
    title: translation.title,
    summary: translation.summary,
    content: translation.content,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription
  };
}

articleRouter.get("/articles", async (req, res) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const take = Math.min(Number(req.query.limit ?? 12), 200);
  const category = req.query.category?.toString();
  const lang = req.query.lang?.toString();
  const categoryRow = category ? await prisma.category.findUnique({ where: { slug: category } }) : null;
  const where = {
    deletedAt: null,
    status: "PUBLISHED" as ArticleStatus,
    ...(categoryRow ? { OR: [{ categoryId: categoryRow.id }, { extraCategoryIds: { has: categoryRow.id } }] } : category ? { category: { slug: category } } : {})
  };
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        category: true,
        author: { select: { name: true } },
        ...(isLang(lang) ? { translations: { where: { lang, status: "READY" } } } : {})
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * take,
      take
    }),
    prisma.article.count({ where })
  ]);
  res.json({ items: items.map((item) => applyTranslation(item, lang)), total, page, pages: Math.ceil(total / take) });
});

articleRouter.get("/articles/:slug", async (req, res) => {
  const lang = req.query.lang?.toString();
  const article = await prisma.article
    .update({
      where: { slug: req.params.slug },
      data: { viewsCount: { increment: 1 } },
      include: {
        category: true,
        author: { select: { name: true } },
        ...(isLang(lang) ? { translations: { where: { lang, status: "READY" } } } : {})
      }
    })
    .catch(() => null);
  if (!article || article.deletedAt || article.status !== "PUBLISHED") return res.status(404).json({ message: "Topilmadi" });
  res.json(applyTranslation(article, lang));
});

articleRouter.get("/search", async (req, res) => {
  const q = req.query.q?.toString() ?? "";
  const lang = req.query.lang?.toString();
  const translatedSearch =
    isLang(lang) && q
      ? {
          translations: {
            some: {
              lang,
              status: "READY" as const,
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { summary: { contains: q, mode: "insensitive" as const } },
                { content: { contains: q, mode: "insensitive" as const } }
              ]
            }
          }
        }
      : undefined;
  const items = await prisma.article.findMany({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        ...(translatedSearch ? [translatedSearch] : [])
      ]
    },
    include: {
      category: true,
      ...(isLang(lang) ? { translations: { where: { lang, status: "READY" } } } : {})
    },
    take: 20
  });
  res.json({ items: items.map((item) => applyTranslation(item, lang)) });
});

articleRouter.get("/admin/articles", requireAuth, permit("articles.read"), async (req, res) => {
  const status = req.query.status?.toString() as ArticleStatus | undefined;
  const trashed = req.query.trashed?.toString() === "true";
  const search = req.query.search?.toString();
  const items = await prisma.article.findMany({
    where: {
      deletedAt: trashed ? { not: null } : null,
      ...(status ? { status } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {})
    },
    include: {
      category: true,
      author: { select: { name: true } },
      translations: { select: { lang: true, status: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  res.json({ items });
});

articleRouter.get("/admin/articles/:id", requireAuth, permit("articles.read"), async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    include: { category: true, author: { select: { name: true } }, translations: true }
  });
  if (!article) return res.status(404).json({ message: "Topilmadi" });
  res.json(article);
});

articleRouter.post("/admin/articles", requireAuth, permit("articles.create"), async (req, res) => {
  const data = articleSchema.parse(req.body);
  const article = await prisma.article.create({
    data: {
      ...data,
      mainImage: data.mainImage || null,
      gallery: data.gallery ?? [],
      extraCategoryIds: (data.extraCategoryIds ?? []).filter((id) => id !== data.categoryId),
      authorId: req.user!.id,
      slug: data.slug || slugify(data.title, { lower: true, strict: true }),
      publishedAt: data.status === "PUBLISHED" ? new Date() : null
    }
  });
  await audit(req, "ARTICLE_CREATE", "Article", article.id, { title: article.title, status: article.status });
  queueTranslations(article);
  res.status(201).json(article);
});

articleRouter.put("/admin/articles/:id", requireAuth, permit("articles.update"), async (req, res) => {
  const data = articleSchema.partial().parse(req.body);
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(data.extraCategoryIds || data.categoryId
        ? { extraCategoryIds: (data.extraCategoryIds ?? []).filter((id) => id !== (data.categoryId ?? undefined)) }
        : {})
    }
  });
  await audit(req, "ARTICLE_UPDATE", "Article", article.id, data);
  if (data.title || data.summary || data.content || data.seoTitle || data.seoDescription) {
    queueTranslations(article);
  }
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

articleRouter.patch("/admin/articles/:id/flags", requireAuth, permit("articles.update"), async (req, res) => {
  const flagsSchema = z
    .object({
      isFeatured: z.boolean(),
      isBreaking: z.boolean(),
      isEditorChoice: z.boolean(),
      showOnHome: z.boolean(),
      showInSlider: z.boolean(),
      showInSidebar: z.boolean(),
      showInLatest: z.boolean(),
      showInPopular: z.boolean()
    })
    .partial();
  const data = flagsSchema.parse(req.body);
  const article = await prisma.article.update({ where: { id: req.params.id }, data });
  await audit(req, "ARTICLE_FLAGS", "Article", article.id, data);
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

articleRouter.delete("/admin/articles/:id/permanent", requireAuth, permit("articles.delete"), async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ message: "Topilmadi" });
  if (!article.deletedAt) return res.status(400).json({ message: "Avval maqolani trash qiling" });
  await prisma.article.delete({ where: { id: req.params.id } });
  await audit(req, "ARTICLE_PERMANENT_DELETE", "Article", req.params.id, { title: article.title });
  res.json({ ok: true });
});

articleRouter.post("/admin/articles/bulk-trash", requireAuth, permit("articles.delete"), async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  await prisma.article.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  await audit(req, "ARTICLE_BULK_TRASH", "Article", undefined, { ids });
  res.json({ ok: true, count: ids.length });
});

articleRouter.post("/admin/articles/bulk-restore", requireAuth, permit("articles.delete"), async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  await prisma.article.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
  await audit(req, "ARTICLE_BULK_RESTORE", "Article", undefined, { ids });
  res.json({ ok: true, count: ids.length });
});

articleRouter.post("/admin/articles/:id/translations/:lang/regenerate", requireAuth, permit("articles.update"), async (req, res) => {
  const lang = req.params.lang;
  if (!isLang(lang)) return res.status(400).json({ message: "Noto'g'ri til" });
  await regenerateTranslation(req.params.id, lang);
  const translation = await prisma.articleTranslation.findUnique({ where: { articleId_lang: { articleId: req.params.id, lang } } });
  await audit(req, "ARTICLE_TRANSLATION_REGENERATE", "Article", req.params.id, { lang });
  res.json(translation);
});
