import { ArticleStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { startOfTashkentDay } from "../../utils/time.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", requireAuth, permit("dashboard.read"), async (_req, res) => {
  const today = startOfTashkentDay();
  const [totalArticles, todayArticles, draftArticles, reviewArticles, users, subscribers, popular] = await Promise.all([
    prisma.article.count({ where: { deletedAt: null } }),
    prisma.article.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
    prisma.article.count({ where: { deletedAt: null, status: ArticleStatus.DRAFT } }),
    prisma.article.count({ where: { deletedAt: null, status: ArticleStatus.REVIEW } }),
    prisma.user.count(),
    prisma.subscriber.count(),
    prisma.article.findMany({
      where: { deletedAt: null, status: ArticleStatus.PUBLISHED },
      orderBy: { viewsCount: "desc" },
      take: 5,
      select: { id: true, title: true, viewsCount: true }
    })
  ]);
  const views = await prisma.article.aggregate({ where: { deletedAt: null }, _sum: { viewsCount: true } });
  res.json({ totalArticles, todayArticles, draftArticles, reviewArticles, users, subscribers, totalViews: views._sum.viewsCount ?? 0, popular });
});
