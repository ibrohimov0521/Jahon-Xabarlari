import { CommentStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { pagination } from "../../utils/query.js";

export const commentRouter = Router();
commentRouter.use(requireAuth, permit("comments.manage"));

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
  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where: {
        ...where
      },
      include: { article: { select: { title: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.comment.count({ where })
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
});

commentRouter.patch("/:id/status", async (req, res) => {
  const status = z.object({ status: z.nativeEnum(CommentStatus) }).parse(req.body).status;
  const item = await prisma.comment.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "COMMENT_STATUS", "Comment", item.id, { status });
  res.json(item);
});
