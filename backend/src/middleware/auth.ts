import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export type AuthUser = {
  id: string;
  role: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Token kerak" });

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: { include: { permissions: true } } }
    });
    if (!user) return res.status(401).json({ message: "Foydalanuvchi topilmadi" });
    req.user = {
      id: user.id,
      role: user.role.name,
      permissions: user.role.permissions.map((item) => item.key)
    };
    next();
  } catch {
    return res.status(401).json({ message: "Token yaroqsiz" });
  }
}

export function permit(...keys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const rolePrefix = req.user?.role.toLowerCase();
    const allowed =
      req.user?.role === "SUPER_ADMIN" ||
      keys.every((key) => req.user?.permissions.includes(key) || req.user?.permissions.includes(`${rolePrefix}.${key}`));
    if (!allowed) return res.status(403).json({ message: "Ruxsat yo'q" });
    next();
  };
}
