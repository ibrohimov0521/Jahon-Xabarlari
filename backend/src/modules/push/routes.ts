import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { getPushPublicKey } from "../../services/push.js";

export const pushRouter = Router();

const pushEndpoint = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return ["googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"].some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  }, "Push endpoint qo'llab-quvvatlanmaydi");

const subscriptionSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({
    p256dh: z.string().min(40).max(256),
    auth: z.string().min(10).max(128)
  }),
  language: z.enum(["uz", "ru", "en"]).default("uz"),
  importantOnly: z.boolean().default(true),
  categorySlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(12).default([])
});

const pushRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p urinish, birozdan keyin qayta urinib ko'ring" }
});

pushRouter.get("/public-key", (_req, res) => {
  const publicKey = getPushPublicKey();
  if (!publicKey) return res.status(503).json({ message: "Bildirishnomalar hali sozlanmagan" });
  res.json({ publicKey });
});

pushRouter.post("/subscriptions", pushRateLimit, async (req, res) => {
  if (!getPushPublicKey()) return res.status(503).json({ message: "Bildirishnomalar hali sozlanmagan" });
  const data = subscriptionSchema.parse(req.body);
  await prisma.webPushSubscription.upsert({
    where: { endpoint: data.endpoint },
    update: {
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      language: data.language,
      importantOnly: data.importantOnly,
      categorySlugs: data.categorySlugs,
      enabled: true,
      failureCount: 0
    },
    create: {
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      language: data.language,
      importantOnly: data.importantOnly,
      categorySlugs: data.categorySlugs
    }
  });
  res.status(201).json({ ok: true });
});

pushRouter.delete("/subscriptions", pushRateLimit, async (req, res) => {
  const { endpoint } = z.object({ endpoint: pushEndpoint }).parse(req.body);
  await prisma.webPushSubscription.deleteMany({ where: { endpoint } });
  res.json({ ok: true });
});
