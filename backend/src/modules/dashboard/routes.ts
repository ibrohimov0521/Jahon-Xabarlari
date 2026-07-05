import { ArticleStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", requireAuth, permit("dashboard.read"), async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalArticles, todayArticles, draftArticles, reviewArticles, users, subscribers, popular] = await Promise.all([
    prisma.article.count({ where: { deletedAt: null } }),
    prisma.article.count({ where: { createdAt: { gte: today } } }),
    prisma.article.count({ where: { status: ArticleStatus.DRAFT } }),
    prisma.article.count({ where: { status: ArticleStatus.REVIEW } }),
    prisma.user.count(),
    prisma.subscriber.count(),
    prisma.article.findMany({ orderBy: { viewsCount: "desc" }, take: 5, select: { id: true, title: true, viewsCount: true } })
  ]);
  const views = await prisma.article.aggregate({ _sum: { viewsCount: true } });
  res.json({ totalArticles, todayArticles, draftArticles, reviewArticles, users, subscribers, totalViews: views._sum.viewsCount ?? 0, popular });
});
