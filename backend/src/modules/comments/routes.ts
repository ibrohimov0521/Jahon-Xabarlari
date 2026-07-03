import { CommentStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { audit } from "../../middleware/audit.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const commentRouter = Router();
commentRouter.use(requireAuth, permit("comments.manage"));

commentRouter.get("/", async (req, res) => {
  const status = req.query.status?.toString() as CommentStatus | undefined;
  const search = req.query.search?.toString();
  res.json({
    items: await prisma.comment.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search ? { body: { contains: search, mode: "insensitive" } } : {})
      },
      include: { article: { select: { title: true, slug: true } } },
      orderBy: { createdAt: "desc" }
    })
  });
});

commentRouter.patch("/:id/status", async (req, res) => {
  const status = z.object({ status: z.nativeEnum(CommentStatus) }).parse(req.body).status;
  const item = await prisma.comment.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, "COMMENT_STATUS", "Comment", item.id, { status });
  res.json(item);
});
