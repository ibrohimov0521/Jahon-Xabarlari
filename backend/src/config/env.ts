import "dotenv/config";
import { z } from "zod";

// Rejects the placeholders shipped in .env.example (and any obvious "change me" value) so a
// deploy that copies the example verbatim fails fast instead of running with public secrets.
// 32 chars is the practical floor for a signing key an attacker shouldn't be able to brute-force.
const strongSecret = (label: string) =>
  z
    .string()
    .min(32, `${label} kamida 32 belgidan iborat bo'lishi kerak`)
    .refine((value) => !/change|replace|placeholder|example|your[_-]?secret/i.test(value), {
      message: `${label} standart placeholder qiymatda qolgan — yangi maxfiy kalit o'rnating`
    });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: strongSecret("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: strongSecret("JWT_REFRESH_SECRET"),
  // Shared secret the Telegram bot must send (X-Bot-Secret header) to use /auth/telegram-login.
  // Optional so the API still boots without it, but the route fails closed when it's unset.
  BOT_SERVICE_SECRET: z.string().min(24).optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URLS: z.string().optional(),
  API_PORT: z.coerce.number().optional(),
  PORT: z.coerce.number().optional(),
  OPENAI_API_KEY: z.string().optional(),
  WEATHERAPI_API_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().min(40).optional(),
  VAPID_PRIVATE_KEY: z.string().min(30).optional(),
  VAPID_SUBJECT: z.string().default("mailto:info@jahonxabarlari.uz"),
  NEWS_AGGREGATOR_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  NEWS_AGGREGATOR_INTERVAL_MINUTES: z.coerce.number().min(1).default(5),
  NEWS_AGGREGATOR_STATUS: z.enum(["PUBLISHED", "REVIEW", "DRAFT"]).default("REVIEW"),
  // Auto-publishing is a separate explicit opt-in. A legacy PUBLISHED status alone no longer
  // bypasses editorial review when a deployment picks up the safer pipeline.
  NEWS_AGGREGATOR_AUTO_PUBLISH: z
    .string()
    .optional()
    .transform((value) => value === "true")
});

export const env = schema.parse(process.env);
export const apiPort = env.PORT ?? env.API_PORT ?? 4000;
export const frontendOrigins = [
  env.FRONTEND_URL,
  ...(env.FRONTEND_URLS?.split(",").map((item) => item.trim()).filter(Boolean) ?? [])
];
