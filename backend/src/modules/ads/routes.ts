import { AdvertisementStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { pagination } from "../../utils/query.js";

export const adRouter = Router();
export const publicAdRouter = Router();

export const AD_PLACEMENTS = [
  "HOME_BANNER",
  "HOME_FEED",
  "HOME_SIDEBAR",
  "ARTICLE_INLINE",
  "ARTICLE_BOTTOM"
] as const;

const placementSchema = z.enum(AD_PLACEMENTS);
const adIdsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const optionalHttpUrl = z
  .string()
  .url()
  .max(2_048)
  .refine(isHttpUrl, "Faqat http/https URL ruxsat etiladi")
  .optional()
  .or(z.literal(""));

const adFields = z.object({
  title: z.string().trim().min(2).max(160),
  placement: placementSchema,
  imageUrl: optionalHttpUrl,
  targetUrl: optionalHttpUrl,
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  sponsorName: z.string().trim().max(100).optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  showOnMobile: z.boolean().default(true),
  showOnDesktop: z.boolean().default(true),
  startAt: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.date().nullable().optional()),
  endAt: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.date().nullable().optional()),
  status: z.nativeEnum(AdvertisementStatus).default("DRAFT")
});

function validateSchedule(data: Partial<z.infer<typeof adFields>>, ctx: z.RefinementCtx) {
  if (!data.showOnMobile && !data.showOnDesktop) {
    ctx.addIssue({ code: "custom", path: ["showOnMobile"], message: "Kamida bitta qurilma turi tanlanishi kerak" });
  }
  if (data.startAt && data.endAt && data.endAt <= data.startAt) {
    ctx.addIssue({ code: "custom", path: ["endAt"], message: "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak" });
  }
  if (data.placement === "HOME_SIDEBAR" && (data.showOnMobile !== false || data.showOnDesktop === false)) {
    ctx.addIssue({ code: "custom", path: ["placement"], message: "Yon panel faqat desktop qurilmalarda ko'rsatiladi" });
  }
  if (data.status === AdvertisementStatus.ACTIVE) {
    if (!data.imageUrl) ctx.addIssue({ code: "custom", path: ["imageUrl"], message: "Faol reklama uchun rasm yoki video kerak" });
    if (!data.targetUrl) ctx.addIssue({ code: "custom", path: ["targetUrl"], message: "Faol reklama uchun o'tish havolasi kerak" });
  }
}

const adSchema = adFields.superRefine(validateSchedule);

const publicAdSelect = {
  id: true,
  title: true,
  placement: true,
  imageUrl: true,
  targetUrl: true,
  altText: true,
  sponsorName: true,
  showOnMobile: true,
  showOnDesktop: true,
  priority: true
} as const;

function rotatingAd<T>(candidates: T[]): T | null {
  if (!candidates.length) return null;
  // The query is ordered by priority, but every active campaign receives a turn.
  return candidates[Math.floor(Date.now() / 60_000) % candidates.length];
}

publicAdRouter.get("/", async (req, res) => {
  const placement = placementSchema.parse(req.query.placement);
  const device = z.enum(["mobile", "desktop"]).default("desktop").parse(req.query.device);
  const now = new Date();
  const candidates = await prisma.advertisement.findMany({
    where: {
      placement,
      status: AdvertisementStatus.ACTIVE,
      imageUrl: { not: null },
      targetUrl: { not: null },
      ...(device === "mobile" ? { showOnMobile: true } : { showOnDesktop: true }),
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gt: now } }] }
      ]
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 10,
    select: publicAdSelect
  });
  const item = rotatingAd(candidates);
  res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=45").json({ item });
});

publicAdRouter.post("/:id/impression", async (req, res) => {
  await prisma.advertisement.updateMany({
    where: { id: req.params.id, status: AdvertisementStatus.ACTIVE },
    data: { impressions: { increment: 1 } }
  });
  res.status(204).end();
});

publicAdRouter.post("/:id/click", async (req, res) => {
  await prisma.advertisement.updateMany({
    where: { id: req.params.id, status: AdvertisementStatus.ACTIVE },
    data: { clicks: { increment: 1 } }
  });
  res.status(204).end();
});

adRouter.use(requireAuth, permit("ads.manage"));

adRouter.get("/", async (req, res) => {
  const { page, take, skip } = pagination(req.query, { limit: 30, max: 100 });
  const search = req.query.search?.toString().trim().slice(0, 160);
  const statusResult = req.query.status ? z.nativeEnum(AdvertisementStatus).safeParse(req.query.status) : null;
  if (statusResult && !statusResult.success) return res.status(400).json({ message: "Noto'g'ri reklama statusi" });
  const placementResult = req.query.placement ? placementSchema.safeParse(req.query.placement) : null;
  if (placementResult && !placementResult.success) return res.status(400).json({ message: "Noto'g'ri reklama joylashuvi" });
  const where = {
    ...(statusResult?.data ? { status: statusResult.data } : {}),
    ...(placementResult?.data ? { placement: placementResult.data } : {}),
    ...(search ? { OR: [
      { title: { contains: search, mode: "insensitive" as const } },
      { sponsorName: { contains: search, mode: "insensitive" as const } }
    ] } : {})
  };
  const [items, total, aggregate, grouped] = await Promise.all([
    prisma.advertisement.findMany({ where, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], skip, take }),
    prisma.advertisement.count({ where }),
    prisma.advertisement.aggregate({ _sum: { impressions: true, clicks: true }, _count: { _all: true } }),
    prisma.advertisement.groupBy({ by: ["status"], _count: { _all: true } })
  ]);
  const counts = Object.fromEntries(grouped.map((item) => [item.status, item._count._all]));
  res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / take),
    summary: {
      total: aggregate._count._all,
      active: counts.ACTIVE ?? 0,
      impressions: aggregate._sum.impressions ?? 0,
      clicks: aggregate._sum.clicks ?? 0
    }
  });
});

adRouter.post("/bulk-status", async (req, res) => {
  const { ids } = adIdsSchema.parse(req.body);
  const status = z.object({ status: z.nativeEnum(AdvertisementStatus) }).parse(req.body).status;
  if (status === AdvertisementStatus.ACTIVE) {
    const incomplete = await prisma.advertisement.count({ where: { id: { in: ids }, OR: [{ imageUrl: null }, { targetUrl: null }] } });
    if (incomplete) return res.status(400).json({ message: `${incomplete} ta reklamada media yoki o'tish havolasi yo'q` });
  }
  const result = await prisma.advertisement.updateMany({ where: { id: { in: ids } }, data: { status } });
  await audit(req, "ADVERTISEMENT_BULK_STATUS", "Advertisement", undefined, { ids, status, count: result.count });
  res.json({ ok: true, count: result.count });
});

adRouter.post("/bulk-delete", async (req, res) => {
  const { ids } = adIdsSchema.parse(req.body);
  const result = await prisma.advertisement.deleteMany({ where: { id: { in: ids } } });
  await audit(req, "ADVERTISEMENT_BULK_DELETE", "Advertisement", undefined, { ids, count: result.count });
  res.json({ ok: true, count: result.count });
});

adRouter.post("/", async (req, res) => {
  const data = adSchema.parse(req.body);
  const item = await prisma.advertisement.create({
    data: {
      ...data,
      imageUrl: data.imageUrl || null,
      targetUrl: data.targetUrl || null,
      altText: data.altText || null,
      sponsorName: data.sponsorName || null
    }
  });
  await audit(req, "ADVERTISEMENT_CREATE", "Advertisement", item.id, { title: item.title });
  res.status(201).json(item);
});

adRouter.put("/:id", async (req, res) => {
  const data = adSchema.parse(req.body);
  const item = await prisma.advertisement.update({
    where: { id: req.params.id },
    data: {
      ...data,
      imageUrl: data.imageUrl || null,
      targetUrl: data.targetUrl || null,
      altText: data.altText || null,
      sponsorName: data.sponsorName || null
    }
  });
  await audit(req, "ADVERTISEMENT_UPDATE", "Advertisement", item.id, data);
  res.json(item);
});

adRouter.patch("/:id/status", async (req, res) => {
  const status = z.object({ status: z.nativeEnum(AdvertisementStatus) }).parse(req.body).status;
  if (status === AdvertisementStatus.ACTIVE) {
    const current = await prisma.advertisement.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ message: "Reklama topilmadi" });
    if (!current.imageUrl || !current.targetUrl) {
      return res.status(400).json({ message: "Faollashtirishdan oldin rasm/video va o'tish havolasini kiriting" });
    }
  }
  const item = await prisma.advertisement.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "ADVERTISEMENT_STATUS", "Advertisement", item.id, { status });
  res.json(item);
});

adRouter.delete("/:id", async (req, res) => {
  await prisma.advertisement.delete({ where: { id: req.params.id } });
  await audit(req, "ADVERTISEMENT_DELETE", "Advertisement", req.params.id);
  res.json({ ok: true });
});
