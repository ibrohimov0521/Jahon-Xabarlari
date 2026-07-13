import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { permit, requireAuth } from "../../middleware/auth.js";
import { pagination } from "../../utils/query.js";

export const auditRouter = Router();
auditRouter.use(requireAuth, permit("audit.read"));

auditRouter.get("/", async (req, res) => {
  const { page, take, skip } = pagination(req.query);
  const entity = req.query.entity?.toString();
  const action = req.query.action?.toString();
  const where = {
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {})
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take
    }),
    prisma.auditLog.count({ where })
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / take) });
});
