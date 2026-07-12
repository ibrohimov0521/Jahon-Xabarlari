import { ArticleStatus } from "@prisma/client";
import crypto from "crypto";
import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import slugify from "slugify";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { AiNotConfiguredError, generateArticleShortDescription } from "../../services/ai.js";
import { queueArticlePush } from "../../services/push.js";
import { LANGS, queueTranslations, regenerateTranslation, type Lang } from "../../services/translate.js";

export const articleRouter = Router();

const articleSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional(),
  summary: z.string().min(10),
  shortDescription: z.string().optional(),
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
const aiShortDescriptionSchema = z.object({
  title: z.string().min(3),
  summary: z.string().optional(),
  content: z.string().min(20)
});
const VIEW_WINDOW_MS = 6 * 60 * 60 * 1000;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

const aiGenerationLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "AI so'rovlari juda ko'p yuborildi, birozdan keyin qayta urinib ko'ring" }
});

function isLang(value: string | undefined): value is Lang {
  return !!value && (LANGS as readonly string[]).includes(value);
}

function viewerHash(req: Request) {
  const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  const userAgent = req.headers["user-agent"]?.toString() || "unknown";
  return crypto.createHash("sha256").update(`${ip}:${userAgent}`).digest("hex");
}

function startOfTashkentDay(date = new Date()) {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TASHKENT_OFFSET_MS);
}

function daysAgoFromTashkentDay(days: number) {
  return new Date(startOfTashkentDay().getTime() - days * 24 * 60 * 60 * 1000);
}

function applyTranslation<T extends { title: string; summary: string; shortDescription?: string | null; content: string; seoTitle: string | null; seoDescription: string | null }>(
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
    shortDescription: article.shortDescription,
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

articleRouter.get("/articles/trending", async (req, res) => {
  const lang = req.query.lang?.toString();
  const take = Math.min(Number(req.query.limit ?? 8), 20);
  const since = startOfTashkentDay();

  const grouped = await prisma.articleView.groupBy({
    by: ["articleId"],
    where: { createdAt: { gte: since } },
    _count: { articleId: true },
    orderBy: { _count: { articleId: "desc" } },
    take: 100
  });

  const includeArgs = {
    category: true,
    ...(isLang(lang) ? { translations: { where: { lang, status: "READY" as const } } } : {})
  };

  if (!grouped.length) return res.json({ items: [] });

  const ids = grouped.map((item) => item.articleId);
  // No publishedAt filter: "trending" is driven by today's view counts (the groupBy above already
  // scopes views to `since`), so an older article being read heavily today must still qualify.
  const articles = await prisma.article.findMany({
    where: { id: { in: ids }, deletedAt: null, status: "PUBLISHED" },
    include: includeArgs
  });
  const order = new Map(ids.map((id, index) => [id, index]));
  const sorted = articles.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, take);

  res.json({ items: sorted.map((item) => applyTranslation(item, lang)) });
});

articleRouter.get("/articles/popular", async (req, res) => {
  const lang = req.query.lang?.toString();
  const take = Math.min(Number(req.query.limit ?? 8), 20);
  const days = Math.min(Math.max(Number(req.query.days ?? 4), 1), 30);
  const since = daysAgoFromTashkentDay(days - 1);

  const items = await prisma.article.findMany({
    where: { deletedAt: null, status: "PUBLISHED", publishedAt: { gte: since } },
    include: {
      category: true,
      ...(isLang(lang) ? { translations: { where: { lang, status: "READY" as const } } } : {})
    },
    orderBy: [{ viewsCount: "desc" }, { publishedAt: "desc" }],
    take
  });

  res.json({ items: items.map((item) => applyTranslation(item, lang)) });
});

articleRouter.get("/articles/:slug", async (req, res) => {
  const lang = req.query.lang?.toString();
  const article = await prisma.article
    .findUnique({
      where: { slug: req.params.slug },
      include: {
        category: true,
        author: { select: { name: true } },
        ...(isLang(lang) ? { translations: { where: { lang, status: "READY" } } } : {})
      }
    })
    .catch(() => null);
  if (!article || article.deletedAt || article.status !== "PUBLISHED") return res.status(404).json({ message: "Topilmadi" });

  const ipHash = viewerHash(req);
  const since = new Date(Date.now() - VIEW_WINDOW_MS);
  const existingView = await prisma.articleView.findFirst({
    where: {
      articleId: article.id,
      ipHash,
      createdAt: { gte: since }
    },
    select: { id: true }
  });

  let viewsCount = article.viewsCount;
  if (!existingView) {
    await prisma.$transaction([
      prisma.articleView.create({ data: { articleId: article.id, ipHash } }),
      prisma.article.update({ where: { id: article.id }, data: { viewsCount: { increment: 1 } } })
    ]);
    viewsCount += 1;
  }

  res.json(applyTranslation({ ...article, viewsCount }, lang));
});

// Public comments -- only APPROVED ones are visible; new submissions land as PENDING and wait
// for admin moderation via the existing /api/admin/comments panel.
const commentCreateSchema = z.object({
  name: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lsin").max(60),
  body: z.string().trim().min(3, "Izoh kamida 3 ta belgidan iborat bo'lsin").max(1000)
});

const commentRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p izoh yuborildi, birozdan keyin qayta urinib ko'ring" }
});

articleRouter.get("/articles/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { articleId: req.params.id, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, body: true, createdAt: true }
  });
  res.json({ items: comments });
});

articleRouter.post("/articles/:id/comments", commentRateLimit, async (req, res) => {
  const data = commentCreateSchema.parse(req.body);
  const article = await prisma.article.findUnique({ where: { id: req.params.id }, select: { id: true, deletedAt: true, status: true } });
  if (!article || article.deletedAt || article.status !== "PUBLISHED") return res.status(404).json({ message: "Maqola topilmadi" });

  const comment = await prisma.comment.create({
    data: { articleId: article.id, name: data.name, body: data.body, status: "PENDING" }
  });
  res.status(201).json({ id: comment.id, message: "Izohingiz yuborildi, moderatsiyadan so'ng ko'rinadi" });
});

articleRouter.get("/search", async (req, res) => {
  const q = req.query.q?.toString() ?? "";
  const lang = req.query.lang?.toString();
  const category = req.query.category?.toString();
  const sort = req.query.sort?.toString();
  const categoryRow = category ? await prisma.category.findUnique({ where: { slug: category } }) : null;
  const categoryFilter = categoryRow ? { OR: [{ categoryId: categoryRow.id }, { extraCategoryIds: { has: categoryRow.id } }] } : category ? { category: { slug: category } } : {};
  const orderBy = sort === "popular" ? { viewsCount: "desc" as const } : { publishedAt: "desc" as const };
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
      AND: [
        categoryFilter,
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            ...(translatedSearch ? [translatedSearch] : [])
          ]
        }
      ]
    },
    include: {
      category: true,
      ...(isLang(lang) ? { translations: { where: { lang, status: "READY" } } } : {})
    },
    orderBy,
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

articleRouter.post("/admin/ai/short-description", requireAuth, permit("articles.create"), aiGenerationLimit, async (req, res) => {
  const data = aiShortDescriptionSchema.parse(req.body);
  try {
    const shortDescription = await generateArticleShortDescription(data);
    res.json({ shortDescription });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return res.status(503).json({ message: error.message });
    const message = error instanceof Error ? error.message : "AI qisqa izoh yarata olmadi";
    res.status(502).json({ message });
  }
});

articleRouter.post("/admin/articles", requireAuth, permit("articles.create"), async (req, res) => {
  const data = articleSchema.parse(req.body);
  if (data.status === "SCHEDULED") {
    return res.status(400).json({ message: "Rejalashtirish uchun maqolalar ro'yxatidagi status menyusidan sana tanlang" });
  }
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
  queueArticlePush(article.id);
  res.status(201).json(article);
});

articleRouter.put("/admin/articles/:id", requireAuth, permit("articles.update"), async (req, res) => {
  const data = articleSchema.partial().parse(req.body);
  if (data.status === "SCHEDULED") {
    return res.status(400).json({ message: "Rejalashtirish uchun maqolalar ro'yxatidagi status menyusidan sana tanlang" });
  }
  const statusChangedToPublished = data.status === "PUBLISHED";
  const statusChangedAwayFromPublished = data.status && data.status !== "PUBLISHED";
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(data.mainImage !== undefined ? { mainImage: data.mainImage || null } : {}),
      ...(data.gallery !== undefined ? { gallery: data.gallery } : {}),
      ...(statusChangedToPublished ? { publishedAt: new Date(), scheduledAt: null } : {}),
      ...(statusChangedAwayFromPublished ? { publishedAt: null, scheduledAt: null } : {}),
      ...(data.extraCategoryIds || data.categoryId
        ? { extraCategoryIds: (data.extraCategoryIds ?? []).filter((id) => id !== (data.categoryId ?? undefined)) }
        : {})
    }
  });
  await audit(req, "ARTICLE_UPDATE", "Article", article.id, data);
  if (data.title || data.summary || data.shortDescription || data.content || data.seoTitle || data.seoDescription) {
    queueTranslations(article);
  }
  queueArticlePush(article.id);
  res.json(article);
});

articleRouter.patch("/admin/articles/:id/status", requireAuth, permit("articles.publish"), async (req, res) => {
  const { status, scheduledAt } = z
    .object({ status: z.nativeEnum(ArticleStatus), scheduledAt: z.coerce.date().optional() })
    .parse(req.body);
  if (status === "SCHEDULED" && (!scheduledAt || scheduledAt <= new Date())) {
    return res.status(400).json({ message: "Rejalashtirish uchun kelajakdagi sana kerak" });
  }
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      scheduledAt: status === "SCHEDULED" ? scheduledAt : null
    }
  });
  await audit(req, "ARTICLE_STATUS", "Article", article.id, { status });
  queueArticlePush(article.id);
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
  queueArticlePush(article.id);
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
  if (!translation) return res.status(404).json({ message: "Tarjima topilmadi" });
  await audit(req, "ARTICLE_TRANSLATION_REGENERATE", "Article", req.params.id, { lang });
  res.json(translation);
});

// Promotes SCHEDULED articles whose scheduledAt has passed to PUBLISHED -- called from a
// periodic sweep in server.ts, mirroring the aggregator's own interval pattern.
export async function publishScheduledArticles() {
  const due = await prisma.article.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true }
  });
  if (!due.length) return;
  await prisma.article.updateMany({
    where: { id: { in: due.map((item) => item.id) } },
    data: { status: "PUBLISHED", publishedAt: new Date(), scheduledAt: null }
  });
  due.forEach((item) => queueArticlePush(item.id));
  console.log(`[scheduler] ${due.length} ta rejalashtirilgan maqola nashr qilindi`);
}
