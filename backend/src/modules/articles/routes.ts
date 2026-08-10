import { ArticleReportStatus, ArticleStatus, InstagramFormat, Prisma } from "@prisma/client";
import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import slugify from "slugify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { hasPermission, permit, requireAuth } from "../../middleware/auth.js";
import { AiNotConfiguredError, generateArticleShortDescription } from "../../services/ai.js";
import { queueArticlePush } from "../../services/push.js";
import { queueArticleInstagramPost } from "../../services/instagram.js";
import { queueArticleTelegramPost } from "../../services/telegram-channel.js";
import { withRedisLock } from "../../services/redis.js";
import { LANGS, queueTranslations, regenerateTranslation, type Lang } from "../../services/translate.js";
import { assertPublicUrl } from "../../services/net-guard.js";
import { pagination, positiveInt } from "../../utils/query.js";
import { buildSeoDescription, buildSeoTitle } from "../../utils/seo.js";
import { buildPublicArticleSearchWhere } from "../../utils/search.js";
import { daysAgoFromTashkentDay, startOfTashkentDay } from "../../utils/time.js";

export const articleRouter = Router();

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrl = z
  .string()
  .url()
  .max(2_048)
  // Zod executes refinements even when .url() has already rejected a value. Keep this
  // predicate total so an empty optional media field becomes a 400 validation error,
  // never an unhandled 500 response.
  .refine(isHttpUrl, "Faqat http/https URL ruxsat etiladi");

const articleSchema = z.object({
  title: z.string().trim().min(3).max(220),
  slug: z.string().trim().max(240).regex(/^[a-z0-9-]+$/).optional().or(z.literal("")),
  summary: z.string().trim().min(10).max(2_000),
  shortDescription: z.string().trim().max(500).optional(),
  content: z.string().trim().min(20).max(250_000),
  mainImage: httpUrl.optional().or(z.literal("")),
  gallery: z.array(httpUrl).max(20).optional(),
  categoryId: z.string().min(1).max(64),
  extraCategoryIds: z
    .array(z.string().min(1).max(64))
    .max(12)
    .refine((items) => new Set(items).size === items.length, "Qo'shimcha kategoriyalar takrorlanmasligi kerak")
    .optional(),
  status: z.nativeEnum(ArticleStatus).default("DRAFT"),
  isFeatured: z.boolean().default(false),
  isBreaking: z.boolean().default(false),
  isEditorChoice: z.boolean().default(false),
  showOnHome: z.boolean().default(true),
  showInSlider: z.boolean().default(false),
  showInSidebar: z.boolean().default(false),
  showInLatest: z.boolean().default(true),
  showInPopular: z.boolean().default(false),
  // Existing articles are intentionally excluded by the database default. New articles opt in
  // here, so enabling Instagram later never floods the account with the old archive.
  instagramEnabled: z.boolean().optional(),
  instagramFormat: z.nativeEnum(InstagramFormat).optional().nullable(),
  seoTitle: z.string().trim().max(220).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  seoKeywords: z.string().trim().max(500).optional()
});

const idsSchema = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(100) });
const bulkStatusSchema = idsSchema.extend({
  status: z.nativeEnum(ArticleStatus),
  scheduledAt: z.coerce.date().optional()
});
const aiShortDescriptionSchema = z.object({
  title: z.string().trim().min(3).max(220),
  summary: z.string().trim().max(2_000).optional(),
  content: z.string().trim().min(20).max(250_000)
});
const VIEW_WINDOW_MS = 6 * 60 * 60 * 1000;

async function validateMediaUrls(mainImage?: string, gallery?: string[]) {
  const urls = [mainImage, ...(gallery ?? [])].filter(Boolean) as string[];
  try {
    await Promise.all(urls.map((url) => {
      const parsed = new URL(url);
      const localUploadedMedia =
        process.env.NODE_ENV !== "production" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        parsed.pathname.startsWith("/api/admin/media/file/");
      return localUploadedMedia ? Promise.resolve() : assertPublicUrl(url);
    }));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Media URL yaroqsiz";
  }
}

async function categoryIdsExist(categoryId: string, extraCategoryIds: string[] = []) {
  const ids = [...new Set([categoryId, ...extraCategoryIds.filter((id) => id !== categoryId)])];
  const count = await prisma.category.count({ where: { id: { in: ids } } });
  return count === ids.length;
}

function setPublicCache(res: Response, seconds = 60) {
  res.set("Cache-Control", `public, max-age=${Math.min(seconds, 60)}, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`);
}

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
  return crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update(`${ip}:${userAgent}`).digest("hex");
}

function applyTranslation<T extends { title: string; summary: string; shortDescription?: string | null; content: string; seoTitle: string | null; seoDescription: string | null }>(
  article: T & { translations?: { lang: string; title: string; summary: string; shortDescription: string | null; content: string; seoTitle: string | null; seoDescription: string | null; status: string }[] },
  lang?: string
) {
  const { translations = [], ...base } = article;
  const availableLanguages = [
    "uz",
    ...translations
      .filter((item) => item.status === "READY" && isLang(item.lang))
      .map((item) => item.lang)
  ];
  if (!isLang(lang)) return { ...base, contentLanguage: "uz" as const, availableLanguages };
  const translation = translations.find((item) => item.lang === lang && item.status === "READY");
  if (!translation) return { ...base, contentLanguage: "uz" as const, availableLanguages };
  return {
    ...base,
    contentLanguage: lang,
    availableLanguages,
    title: translation.title,
    summary: translation.summary,
    shortDescription: translation.shortDescription ?? translation.summary.slice(0, 500),
    content: translation.content,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription
  };
}

function articleListSelect(lang?: string) {
  return {
    id: true,
    title: true,
    slug: true,
    summary: true,
    shortDescription: true,
    mainImage: true,
    viewsCount: true,
    publishedAt: true,
    updatedAt: true,
    isFeatured: true,
    isBreaking: true,
    isEditorChoice: true,
    showOnHome: true,
    showInSlider: true,
    showInSidebar: true,
    showInLatest: true,
    showInPopular: true,
    category: { select: { name: true, slug: true } },
    author: { select: { name: true } },
    translations: {
      where: { lang: isLang(lang) ? lang : "__native__", status: "READY" as const },
      select: { lang: true, title: true, summary: true, shortDescription: true, status: true }
    }
  } satisfies Prisma.ArticleSelect;
}

type ArticleListRow = Prisma.ArticleGetPayload<{ select: ReturnType<typeof articleListSelect> }>;

function applyListTranslation(article: ArticleListRow, lang?: string) {
  const { translations, ...base } = article;
  if (!isLang(lang)) return base;
  const translation = translations.find((item) => item.lang === lang && item.status === "READY");
  if (!translation) return base;
  return {
    ...base,
    title: translation.title,
    summary: translation.summary,
    shortDescription: translation.shortDescription ?? translation.summary.slice(0, 500)
  };
}

articleRouter.get("/articles", async (req, res) => {
  const { page, take, skip } = pagination(req.query, { limit: 12, max: 50, pageMax: 1_000 });
  const category = req.query.category?.toString().slice(0, 100);
  const lang = req.query.lang?.toString();
  const requestedFlags = {
    ...(req.query.home === "true" ? { showOnHome: true } : {}),
    ...(req.query.slider === "true" ? { showInSlider: true } : {}),
    ...(req.query.sidebar === "true" ? { showInSidebar: true } : {}),
    ...(req.query.latest === "true" ? { showInLatest: true } : {}),
    ...(req.query.popular === "true" ? { showInPopular: true } : {}),
    ...(req.query.editorChoice === "true" ? { isEditorChoice: true } : {}),
    ...(req.query.featured === "true" ? { isFeatured: true } : {}),
    ...(req.query.breaking === "true" ? { isBreaking: true } : {})
  };
  const categoryRow = category ? await prisma.category.findUnique({ where: { slug: category } }) : null;
  const where = {
    deletedAt: null,
    status: "PUBLISHED" as ArticleStatus,
    ...requestedFlags,
    ...(categoryRow ? { OR: [{ categoryId: categoryRow.id }, { extraCategoryIds: { has: categoryRow.id } }] } : category ? { category: { slug: category } } : {})
  };
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: articleListSelect(lang),
      orderBy: { publishedAt: "desc" },
      skip,
      take
    }),
    prisma.article.count({ where })
  ]);
  setPublicCache(res, 60);
  res.json({ items: items.map((item) => applyListTranslation(item, lang)), total, page, pages: Math.ceil(total / take) });
});

articleRouter.get("/articles/trending", async (req, res) => {
  const lang = req.query.lang?.toString();
  const take = positiveInt(req.query.limit, 8, 20);
  const since = startOfTashkentDay();

  const grouped = await prisma.articleView.groupBy({
    by: ["articleId"],
    where: {
      createdAt: { gte: since },
      article: {
        deletedAt: null,
        status: "PUBLISHED",
        publishedAt: { gte: since }
      }
    },
    _count: { articleId: true },
    orderBy: { _count: { articleId: "desc" } },
    take: 100
  });

  if (!grouped.length) {
    setPublicCache(res, 60);
    return res.json({ items: [] });
  }

  const ids = grouped.map((item) => item.articleId);
  const articles = await prisma.article.findMany({
    where: { id: { in: ids }, deletedAt: null, status: "PUBLISHED", publishedAt: { gte: since } },
    select: articleListSelect(lang)
  });
  const order = new Map(ids.map((id, index) => [id, index]));
  const sorted = articles.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, take);

  setPublicCache(res, 60);
  res.json({ items: sorted.map((item) => applyListTranslation(item, lang)) });
});

articleRouter.get("/articles/popular", async (req, res) => {
  const lang = req.query.lang?.toString();
  const take = positiveInt(req.query.limit, 8, 20);
  const days = positiveInt(req.query.days, 4, 30);
  const since = daysAgoFromTashkentDay(days - 1);

  const items = await prisma.article.findMany({
    where: { deletedAt: null, status: "PUBLISHED", publishedAt: { gte: since } },
    select: articleListSelect(lang),
    orderBy: [{ showInPopular: "desc" }, { viewsCount: "desc" }, { publishedAt: "desc" }],
    take
  });

  setPublicCache(res, 120);
  res.json({ items: items.map((item) => applyListTranslation(item, lang)) });
});

articleRouter.get("/articles/sitemap", async (_req, res) => {
  const items = await prisma.article.findMany({
    where: { deletedAt: null, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    // Google allows at most 50,000 URLs per sitemap. Leave room for the site's
    // static and category URLs that the Next.js sitemap adds to this list.
    take: 49_000,
    select: {
      slug: true,
      title: true,
      updatedAt: true,
      publishedAt: true,
      translations: {
        where: { status: "READY" },
        select: { lang: true }
      }
    }
  });
  setPublicCache(res, 300);
  res.json({ items });
});

articleRouter.get("/articles/:slug", async (req, res) => {
  const lang = req.query.lang?.toString();
  const article = await prisma.article.findUnique({
    where: { slug: req.params.slug },
    include: {
      category: true,
      author: { select: { name: true } },
      tags: { include: { tag: true } },
      translations: { where: { status: "READY" } }
    }
  });
  if (!article || article.deletedAt || article.status !== "PUBLISHED") return res.status(404).json({ message: "Topilmadi" });

  setPublicCache(res, 60);
  res.json(applyTranslation(article, lang));
});

articleRouter.get("/articles/:slug/context", async (req, res) => {
  const lang = req.query.lang?.toString();
  const current = await prisma.article.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      deletedAt: true,
      status: true,
      publishedAt: true,
      categoryId: true,
      extraCategoryIds: true,
      tags: { select: { tagId: true } }
    }
  });
  if (!current || current.deletedAt || current.status !== "PUBLISHED") return res.status(404).json({ message: "Topilmadi" });

  const tagIds = current.tags.map((item) => item.tagId);
  const categoryIds = [current.categoryId, ...current.extraCategoryIds];
  const related = await prisma.article.findMany({
    where: {
      id: { not: current.id },
      deletedAt: null,
      status: "PUBLISHED",
      OR: [
        { categoryId: { in: categoryIds } },
        { extraCategoryIds: { hasSome: categoryIds } },
        ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : [])
      ]
    },
    select: articleListSelect(lang),
    orderBy: [{ publishedAt: "desc" }, { viewsCount: "desc" }],
    take: 6
  });

  const next = current.publishedAt
    ? await prisma.article.findFirst({
        where: { id: { not: current.id }, deletedAt: null, status: "PUBLISHED", publishedAt: { lt: current.publishedAt } },
        select: articleListSelect(lang),
        orderBy: { publishedAt: "desc" }
      })
    : null;

  setPublicCache(res, 120);
  res.json({ related: related.map((item) => applyListTranslation(item, lang)), next: next ? applyListTranslation(next, lang) : null });
});

const viewRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

articleRouter.post("/articles/:id/view", viewRateLimit, async (req, res) => {
  const articleId = req.params.id;
  const ipHash = viewerHash(req);
  const bucket = Math.floor(Date.now() / VIEW_WINDOW_MS);
  const viewId = crypto.createHash("sha256").update(`${articleId}:${ipHash}:${bucket}`).digest("hex");

  let result: { viewsCount: number } | null;
  try {
    result = await prisma.$transaction(async (tx) => {
      const inserted = await tx.articleView.createMany({
        data: [{ id: viewId, articleId, ipHash }],
        skipDuplicates: true
      });
      if (!inserted.count) {
        return tx.article.findFirst({
          where: { id: articleId, status: "PUBLISHED", deletedAt: null },
          select: { viewsCount: true }
        });
      }
      return tx.article.update({
        where: { id: articleId, status: "PUBLISHED", deletedAt: null },
        data: { viewsCount: { increment: 1 } },
        select: { viewsCount: true }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2003" || error.code === "P2025")) {
      return res.status(404).json({ message: "Maqola topilmadi" });
    }
    throw error;
  }

  if (!result) return res.status(404).json({ message: "Maqola topilmadi" });
  res.json({ viewsCount: result.viewsCount });
});

// Public comments are published immediately. Rate limiting and strict length validation protect
// the endpoint; admins can still hide or permanently remove abusive comments afterwards.
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

const reportSchema = z.object({
  reason: z.enum(["FACT_ERROR", "TYPO", "COPYRIGHT", "INAPPROPRIATE", "OTHER"]),
  details: z.string().trim().min(10).max(1_500),
  email: z.string().trim().email().max(320).optional().or(z.literal(""))
});

const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Xabarlar soni cheklangan, keyinroq qayta urinib ko'ring" }
});

articleRouter.get("/articles/:id/comments", async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: {
      articleId: req.params.id,
      status: "APPROVED",
      article: { status: "PUBLISHED", deletedAt: null }
    },
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
    data: { articleId: article.id, name: data.name, body: data.body, status: "APPROVED" }
  });
  res.status(201).json({
    comment: { id: comment.id, name: comment.name, body: comment.body, createdAt: comment.createdAt },
    message: "Izohingiz saqlandi"
  });
});

articleRouter.post("/articles/:id/reports", reportRateLimit, async (req, res) => {
  const data = reportSchema.parse(req.body);
  const article = await prisma.article.findFirst({
    where: { id: req.params.id, status: "PUBLISHED", deletedAt: null },
    select: { id: true }
  });
  if (!article) return res.status(404).json({ message: "Maqola topilmadi" });
  await prisma.articleReport.create({
    data: {
      articleId: article.id,
      reason: data.reason,
      details: data.details,
      email: data.email || null,
      ipHash: viewerHash(req)
    }
  });
  res.status(201).json({ message: "Xabaringiz tahririyatga yuborildi" });
});

const searchRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p qidiruv so'rovi yuborildi, birozdan keyin qayta urinib ko'ring" }
});

articleRouter.get("/search", searchRateLimit, async (req, res) => {
  const q = req.query.q?.toString().trim().slice(0, 200) ?? "";
  const lang = req.query.lang?.toString();
  const category = req.query.category?.toString().slice(0, 100);
  const sortResult = z.enum(["latest", "popular"]).safeParse(req.query.sort?.toString() ?? "latest");
  if (!sortResult.success) return res.status(400).json({ message: "Noto'g'ri saralash turi" });
  const sort = sortResult.data;
  const cursorRaw = req.query.cursor?.toString();
  const cursorResult = cursorRaw ? z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).safeParse(cursorRaw) : null;
  if (cursorResult && !cursorResult.success) return res.status(400).json({ message: "Noto'g'ri qidiruv kursori" });
  const cursor = cursorResult?.data;
  const take = positiveInt(req.query.limit, 20, 50);
  const categoryRow = category ? await prisma.category.findUnique({ where: { slug: category } }) : null;
  const orderBy = sort === "popular"
    ? [{ viewsCount: "desc" as const }, { id: "desc" as const }]
    : [{ publishedAt: "desc" as const }, { id: "desc" as const }];
  const rows = await prisma.article.findMany({
    where: buildPublicArticleSearchWhere({
      q,
      lang: isLang(lang) ? lang : undefined,
      categoryId: categoryRow?.id,
      categorySlug: categoryRow ? undefined : category
    }),
    select: articleListSelect(lang),
    orderBy,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: take + 1
  });
  const hasMore = rows.length > take;
  const items = rows.slice(0, take);
  setPublicCache(res, 30);
  res.json({
    items: items.map((item) => applyListTranslation(item, lang)),
    hasMore,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null
  });
});

articleRouter.get("/admin/article-reports", requireAuth, permit("comments.manage"), async (req, res) => {
  const statusRaw = req.query.status?.toString();
  const statusResult = statusRaw ? z.nativeEnum(ArticleReportStatus).safeParse(statusRaw) : null;
  if (statusResult && !statusResult.success) return res.status(400).json({ message: "Noto'g'ri status" });
  const { page, take, skip } = pagination(req.query, { limit: 30, max: 100 });
  const where = statusResult?.data ? { status: statusResult.data } : {};
  const [items, total] = await Promise.all([
    prisma.articleReport.findMany({
      where,
      include: { article: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.articleReport.count({ where })
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
});

articleRouter.patch("/admin/article-reports/:id/status", requireAuth, permit("comments.manage"), async (req, res) => {
  const { status } = z.object({ status: z.nativeEnum(ArticleReportStatus) }).parse(req.body);
  const report = await prisma.articleReport.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "ARTICLE_REPORT_STATUS", "ArticleReport", report.id, { status });
  res.json(report);
});

articleRouter.post("/admin/article-reports/bulk-status", requireAuth, permit("comments.manage"), async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  const { status } = z.object({ status: z.nativeEnum(ArticleReportStatus) }).parse(req.body);
  const result = await prisma.articleReport.updateMany({ where: { id: { in: ids } }, data: { status } });
  await audit(req, "ARTICLE_REPORT_BULK_STATUS", "ArticleReport", undefined, { ids, status, count: result.count });
  res.json({ ok: true, count: result.count });
});

articleRouter.get("/admin/articles", requireAuth, permit("articles.read"), async (req, res) => {
  const statusRaw = req.query.status?.toString();
  const statusResult = statusRaw ? z.nativeEnum(ArticleStatus).safeParse(statusRaw) : null;
  if (statusResult && !statusResult.success) return res.status(400).json({ message: "Noto'g'ri maqola statusi" });
  const status = statusResult?.data;
  const trashed = req.query.trashed?.toString() === "true";
  const today = req.query.today?.toString() === "true";
  const search = req.query.search?.toString().trim().slice(0, 200);
  const { page, take, skip } = pagination(req.query);
  const where = {
    deletedAt: trashed ? { not: null } : null,
    ...(today ? { createdAt: { gte: startOfTashkentDay() } } : {}),
    ...(status ? { status } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {})
  };
  const [items, total] = await Promise.all([prisma.article.findMany({
    where: {
      ...where
    },
    include: {
      category: true,
      author: { select: { name: true } },
      translations: { select: { lang: true, status: true } }
    },
    orderBy: { updatedAt: "desc" },
    skip,
    take
  }), prisma.article.count({ where })]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
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
  if (!["DRAFT", "REVIEW"].includes(data.status) && !hasPermission(req, "articles.publish")) {
    return res.status(403).json({ message: "Bu status uchun nashr qilish ruxsati kerak" });
  }
  if (!(await categoryIdsExist(data.categoryId, data.extraCategoryIds))) {
    return res.status(400).json({ message: "Tanlangan kategoriyalardan biri topilmadi" });
  }
  const mediaError = await validateMediaUrls(data.mainImage, data.gallery);
  if (mediaError) return res.status(400).json({ message: mediaError });
  if (data.status === "SCHEDULED") {
    return res.status(400).json({ message: "Rejalashtirish uchun maqolalar ro'yxatidagi status menyusidan sana tanlang" });
  }
  const article = await prisma.article.create({
    data: {
      ...data,
      mainImage: data.mainImage || null,
      gallery: data.gallery ?? [],
      seoTitle: data.seoTitle || buildSeoTitle(data.title),
      seoDescription: data.seoDescription || buildSeoDescription(data.shortDescription, data.summary),
      extraCategoryIds: (data.extraCategoryIds ?? []).filter((id) => id !== data.categoryId),
      instagramEnabled: data.instagramEnabled ?? Boolean(data.mainImage),
      authorId: req.user!.id,
      slug: data.slug || slugify(data.title, { lower: true, strict: true }),
      publishedAt: data.status === "PUBLISHED" ? new Date() : null
    }
  });
  await audit(req, "ARTICLE_CREATE", "Article", article.id, { title: article.title, status: article.status });
  await queueTranslations(article);
  queueArticlePush(article);
  queueArticleTelegramPost(article);
  queueArticleInstagramPost(article);
  res.status(201).json(article);
});

articleRouter.put("/admin/articles/:id", requireAuth, permit("articles.update"), async (req, res) => {
  const data = articleSchema.partial().parse(req.body);
  const mediaError = await validateMediaUrls(data.mainImage, data.gallery);
  if (mediaError) return res.status(400).json({ message: mediaError });
  if (data.status === "SCHEDULED") {
    return res.status(400).json({ message: "Rejalashtirish uchun maqolalar ro'yxatidagi status menyusidan sana tanlang" });
  }
  const current = await prisma.article.findUniqueOrThrow({
    where: { id: req.params.id },
    select: {
      title: true,
      summary: true,
      shortDescription: true,
      status: true,
      publishedAt: true,
      categoryId: true,
      extraCategoryIds: true,
      seoTitle: true,
      seoDescription: true,
      instagramEnabled: true,
      instagramFormat: true
    }
  });
  if (data.status && data.status !== current.status && !hasPermission(req, "articles.publish")) {
    return res.status(403).json({ message: "Maqola statusini o'zgartirish uchun nashr qilish ruxsati kerak" });
  }
  const nextTitle = data.title ?? current.title;
  const nextSummary = data.summary ?? current.summary;
  const nextShortDescription = data.shortDescription ?? current.shortDescription;
  const nextCategoryId = data.categoryId ?? current.categoryId;
  const nextExtraCategoryIds = data.extraCategoryIds ?? current.extraCategoryIds;
  if (!(await categoryIdsExist(nextCategoryId, nextExtraCategoryIds))) {
    return res.status(400).json({ message: "Tanlangan kategoriyalardan biri topilmadi" });
  }
  const seoTitleWasAutomatic = !current.seoTitle || current.seoTitle === buildSeoTitle(current.title);
  const seoDescriptionWasAutomatic =
    !current.seoDescription ||
    current.seoDescription === buildSeoDescription(current.shortDescription, current.summary);

  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(data.slug !== undefined ? { slug: data.slug || slugify(nextTitle, { lower: true, strict: true }) } : {}),
      ...(data.mainImage !== undefined ? { mainImage: data.mainImage || null } : {}),
      ...(data.gallery !== undefined ? { gallery: data.gallery } : {}),
      ...(data.seoTitle !== undefined
        ? { seoTitle: data.seoTitle || buildSeoTitle(nextTitle) }
        : data.title !== undefined && seoTitleWasAutomatic
          ? { seoTitle: buildSeoTitle(nextTitle) }
          : {}),
      ...(data.seoDescription !== undefined
        ? { seoDescription: data.seoDescription || buildSeoDescription(nextShortDescription, nextSummary) }
        : (data.summary !== undefined || data.shortDescription !== undefined) && seoDescriptionWasAutomatic
          ? { seoDescription: buildSeoDescription(nextShortDescription, nextSummary) }
          : {}),
      ...(data.status === "PUBLISHED"
        ? { publishedAt: current.status === "PUBLISHED" ? current.publishedAt ?? new Date() : new Date(), scheduledAt: null }
        : data.status
          ? { publishedAt: null, scheduledAt: null }
          : {}),
      ...(data.extraCategoryIds !== undefined || data.categoryId !== undefined
        ? { extraCategoryIds: nextExtraCategoryIds.filter((id) => id !== nextCategoryId) }
        : {})
    }
  });
  await audit(req, "ARTICLE_UPDATE", "Article", article.id, data);
  if (
    data.title !== undefined ||
    data.summary !== undefined ||
    data.shortDescription !== undefined ||
    data.content !== undefined ||
    data.seoTitle !== undefined ||
    data.seoDescription !== undefined
  ) {
    await queueTranslations(article);
  }
  if (current.status !== "PUBLISHED" && article.status === "PUBLISHED") {
    queueArticlePush(article);
    queueArticleTelegramPost(article);
    queueArticleInstagramPost(article);
  } else if (
    article.status === "PUBLISHED" &&
    (data.instagramEnabled === true || data.instagramFormat !== undefined || data.mainImage !== undefined)
  ) {
    // An editor can enable social delivery or correct the media after the article was already
    // published. The Instagram worker remains idempotent through instagramSentAt.
    queueArticleInstagramPost(article);
  }
  res.json(article);
});

articleRouter.patch("/admin/articles/:id/status", requireAuth, permit("articles.publish"), async (req, res) => {
  const { status, scheduledAt } = z
    .object({ status: z.nativeEnum(ArticleStatus), scheduledAt: z.coerce.date().optional() })
    .parse(req.body);
  if (status === "SCHEDULED" && (!scheduledAt || scheduledAt <= new Date())) {
    return res.status(400).json({ message: "Rejalashtirish uchun kelajakdagi sana kerak" });
  }
  const current = await prisma.article.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { status: true, publishedAt: true }
  });
  const article = await prisma.article.update({
    where: { id: req.params.id },
    data: {
      status,
      publishedAt: status === "PUBLISHED" ? (current.status === "PUBLISHED" ? current.publishedAt ?? new Date() : new Date()) : null,
      scheduledAt: status === "SCHEDULED" ? scheduledAt : null
    }
  });
  await audit(req, "ARTICLE_STATUS", "Article", article.id, { status });
  if (current.status !== "PUBLISHED" && article.status === "PUBLISHED") {
    queueArticlePush(article);
    queueArticleTelegramPost(article);
    queueArticleInstagramPost(article);
  }
  res.json(article);
});

articleRouter.post("/admin/articles/:id/instagram/retry", requireAuth, permit("articles.publish"), async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      deletedAt: true,
      mainImage: true,
      instagramEnabled: true,
      instagramSentAt: true
    }
  });
  if (!article || article.deletedAt || article.status !== "PUBLISHED") {
    return res.status(400).json({ message: "Faqat nashr qilingan faol maqolani Instagramga qayta yuborish mumkin" });
  }
  if (!article.instagramEnabled) {
    return res.status(400).json({ message: "Bu maqola uchun Instagramga yuborish o'chirilgan" });
  }
  if (!article.mainImage) {
    return res.status(400).json({ message: "Instagramga yuborish uchun rasm yoki video biriktiring" });
  }
  if (article.instagramSentAt) {
    return res.status(400).json({ message: "Bu maqola Instagramga allaqachon yuborilgan" });
  }

  queueArticleInstagramPost(article, { force: true });
  await audit(req, "ARTICLE_INSTAGRAM_RETRY", "Article", article.id);
  res.status(202).json({ ok: true, message: "Instagram posti qayta navbatga qo'shildi" });
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
  const result = await prisma.article.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: new Date() } });
  await audit(req, "ARTICLE_BULK_TRASH", "Article", undefined, { ids, count: result.count });
  res.json({ ok: true, count: result.count });
});

articleRouter.post("/admin/articles/bulk-restore", requireAuth, permit("articles.delete"), async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  const result = await prisma.article.updateMany({ where: { id: { in: ids }, deletedAt: { not: null } }, data: { deletedAt: null } });
  await audit(req, "ARTICLE_BULK_RESTORE", "Article", undefined, { ids, count: result.count });
  res.json({ ok: true, count: result.count });
});

articleRouter.post("/admin/articles/bulk-delete", requireAuth, permit("articles.delete"), async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  const rows = await prisma.article.findMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    select: { id: true, title: true }
  });
  const deletableIds = rows.map((item) => item.id);
  const result = deletableIds.length
    ? await prisma.article.deleteMany({ where: { id: { in: deletableIds }, deletedAt: { not: null } } })
    : { count: 0 };
  await audit(req, "ARTICLE_BULK_PERMANENT_DELETE", "Article", undefined, {
    ids: deletableIds,
    titles: rows.map((item) => item.title),
    count: result.count
  });
  res.json({ ok: true, count: result.count });
});

articleRouter.post("/admin/articles/bulk-status", requireAuth, permit("articles.publish"), async (req, res) => {
  const { ids, status, scheduledAt } = bulkStatusSchema.parse(req.body);
  if (status === "SCHEDULED" && (!scheduledAt || scheduledAt <= new Date())) {
    return res.status(400).json({ message: "Rejalashtirish uchun kelajakdagi sana kerak" });
  }

  const current = await prisma.article.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, status: true }
  });
  const targetIds = current.filter((article) => article.status !== status || status === "SCHEDULED").map((article) => article.id);
  const publishedAt = status === "PUBLISHED" ? new Date() : null;

  if (targetIds.length) {
    await prisma.article.updateMany({
      where: { id: { in: targetIds }, deletedAt: null },
      data: {
        status,
        publishedAt,
        scheduledAt: status === "SCHEDULED" ? scheduledAt : null
      }
    });
  }

  await audit(req, "ARTICLE_BULK_STATUS", "Article", undefined, { ids: targetIds, status, scheduledAt, count: targetIds.length });

  if (status === "PUBLISHED" && targetIds.length) {
    targetIds.forEach((id) => {
      queueArticlePush({ id, status, publishedAt });
      queueArticleTelegramPost({ id, status, publishedAt });
      queueArticleInstagramPost({ id, status, publishedAt });
    });
  }

  res.json({ ok: true, count: targetIds.length });
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
  await withRedisLock("lock:scheduled-publisher", 55_000, async () => {
    const publishedAt = new Date();
    // Bound each sweep so a long outage cannot flood the push queue and database in one tick.
    const due = await prisma.article.findMany({
      where: { deletedAt: null, status: "SCHEDULED", scheduledAt: { lte: publishedAt } },
      orderBy: { scheduledAt: "asc" },
      take: 500,
      select: { id: true }
    });
    if (!due.length) return;
    const updated = await prisma.article.updateMany({
      where: { id: { in: due.map((item) => item.id) }, deletedAt: null, status: "SCHEDULED", scheduledAt: { lte: publishedAt } },
      data: { status: "PUBLISHED", publishedAt, scheduledAt: null }
    });
    due.forEach((item) => {
      queueArticlePush({ id: item.id, status: "PUBLISHED", publishedAt });
      queueArticleTelegramPost({ id: item.id, status: "PUBLISHED", publishedAt });
      queueArticleInstagramPost({ id: item.id, status: "PUBLISHED", publishedAt });
    });
    console.log(`[scheduler] ${updated.count} ta rejalashtirilgan maqola nashr qilindi`);
  });
}

export async function cleanupOldArticleViews(retentionDays = 90) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let deletedCount = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    // Keep each transaction bounded so a large production table is not locked by one delete.
    // eslint-disable-next-line no-await-in-loop
    const rows = await prisma.articleView.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: 10_000,
      select: { id: true }
    });
    if (!rows.length) break;
    // eslint-disable-next-line no-await-in-loop
    const deleted = await prisma.articleView.deleteMany({ where: { id: { in: rows.map((item) => item.id) } } });
    deletedCount += deleted.count;
    if (rows.length < 10_000) break;
  }
  if (deletedCount) console.log(`[views] ${deletedCount} ta eski ko'rish yozuvi tozalandi`);
}
