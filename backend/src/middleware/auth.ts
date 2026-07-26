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
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
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

export function hasPermission(req: Request, key: string) {
  const rolePrefix = req.user?.role.toLowerCase();
  return req.user?.role === "SUPER_ADMIN"
    || Boolean(req.user?.permissions.includes(key))
    || Boolean(rolePrefix && req.user?.permissions.includes(`${rolePrefix}.${key}`));
}

export function permit(...keys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!keys.every((key) => hasPermission(req, key))) return res.status(403).json({ message: "Ruxsat yo'q" });
    next();
  };
}
