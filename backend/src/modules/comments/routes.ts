import { CommentStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { pagination } from "../../utils/query.js";

export const commentRouter = Router();
commentRouter.use(requireAuth, permit("comments.manage"));

const idsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

commentRouter.get("/", async (req, res) => {
  const statusRaw = req.query.status?.toString();
  const statusResult = statusRaw ? z.nativeEnum(CommentStatus).safeParse(statusRaw) : null;
  if (statusResult && !statusResult.success) return res.status(400).json({ message: "Noto'g'ri izoh statusi" });
  const status = statusResult?.data;
  const search = req.query.search?.toString().trim().slice(0, 200);
  const { page, take, skip } = pagination(req.query);
  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { body: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };
  const [items, total, grouped] = await Promise.all([
    prisma.comment.findMany({
      where: {
        ...where
      },
      include: { article: { select: { title: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.comment.count({ where }),
    prisma.comment.groupBy({ by: ["status"], _count: { _all: true } })
  ]);
  const counts = Object.fromEntries(grouped.map((item) => [item.status, item._count._all]));
  res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / take),
    summary: {
      total: grouped.reduce((sum, item) => sum + item._count._all, 0),
      approved: counts.APPROVED ?? 0,
      hidden: counts.DELETED ?? 0,
      pending: counts.PENDING ?? 0
    }
  });
});

commentRouter.post("/bulk-status", async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  const status = z.object({ status: z.enum(["APPROVED", "DELETED"]) }).parse(req.body).status;
  const result = await prisma.comment.updateMany({ where: { id: { in: ids } }, data: { status } });
  await audit(req, "COMMENT_BULK_STATUS", "Comment", undefined, { ids, status, count: result.count });
  res.json({ ok: true, count: result.count });
});

commentRouter.post("/bulk-delete", async (req, res) => {
  const { ids } = idsSchema.parse(req.body);
  const result = await prisma.comment.deleteMany({ where: { id: { in: ids }, status: CommentStatus.DELETED } });
  await audit(req, "COMMENT_BULK_DELETE", "Comment", undefined, { ids, count: result.count });
  res.json({ ok: true, count: result.count });
});

commentRouter.patch("/:id/status", async (req, res) => {
  const status = z.object({ status: z.enum(["APPROVED", "DELETED"]) }).parse(req.body).status;
  const item = await prisma.comment.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "COMMENT_STATUS", "Comment", item.id, { status });
  res.json(item);
});

commentRouter.delete("/:id", async (req, res) => {
  const item = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ message: "Izoh topilmadi" });
  if (item.status !== CommentStatus.DELETED) return res.status(400).json({ message: "Avval izohni yashiring" });
  await prisma.comment.delete({ where: { id: item.id } });
  await audit(req, "COMMENT_DELETE", "Comment", item.id, { articleId: item.articleId });
  res.json({ ok: true });
});
