import type { Request } from "express";
import { prisma } from "../config/prisma.js";

export async function audit(req: Request, action: string, entity: string, entityId?: string, metadata?: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      action,
      entity,
      entityId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      ip: req.ip
    }
  });
}
