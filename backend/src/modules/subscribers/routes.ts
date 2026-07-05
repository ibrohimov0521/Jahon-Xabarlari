import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";

export const subscriberRouter = Router();

const subscribeSchema = z.object({ email: z.string().trim().email() });

const subscribeRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p urinish, birozdan keyin qayta urinib ko'ring" }
});

subscriberRouter.post("/", subscribeRateLimit, async (req, res) => {
  const { email } = subscribeSchema.parse(req.body);
  await prisma.subscriber.upsert({
    where: { email },
    update: {},
    create: { email }
  });
  res.status(201).json({ message: "Obuna qabul qilindi" });
});
