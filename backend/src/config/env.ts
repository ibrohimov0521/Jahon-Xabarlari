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

const webOrigin = z.string().trim().url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Origin http:// yoki https:// bo'lishi kerak")
  .transform((value) => value.replace(/\/+$/, ""));

const commaSeparatedOrigins = z.string().optional().refine((value) => {
  if (!value?.trim()) return true;
  return value.split(",").every((item) => webOrigin.safeParse(item).success);
}, "FRONTEND_URLS faqat vergul bilan ajratilgan http(s) originlardan iborat bo'lishi kerak");

const port = z.coerce.number().int().min(1).max(65_535);

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url()
    .refine((value) => ["redis:", "rediss:"].includes(new URL(value).protocol), "REDIS_URL redis:// yoki rediss:// bo'lishi kerak")
    .default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: strongSecret("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: strongSecret("JWT_REFRESH_SECRET"),
  // Shared secret the Telegram bot must send (X-Bot-Secret header) to use /auth/telegram-login.
  // Optional so the API still boots without it, but the route fails closed when it's unset.
  BOT_SERVICE_SECRET: z.string().min(24).optional(),
  // Channel delivery is deliberately separate from the admin bot settings. The same Telegram
  // token can be used, but keeping the variable explicit prevents accidental channel posting.
  TELEGRAM_CHANNEL_BOT_TOKEN: z.string().min(20).optional(),
  TELEGRAM_NEWS_CHANNEL: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^@?[a-zA-Z0-9_]{5,}$/.test(value) || /^-100\d{6,}$/.test(value), {
      message: "TELEGRAM_NEWS_CHANNEL @kanal_nomi yoki -100... kanal ID bo'lishi kerak"
    }),
  TELEGRAM_CHANNEL_POSTING_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  FRONTEND_URL: webOrigin.default("http://localhost:3000"),
  FRONTEND_URLS: commaSeparatedOrigins,
  API_PORT: port.optional(),
  PORT: port.optional(),
  OPENAI_API_KEY: z.string().optional(),
  WEATHERAPI_API_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().min(40).optional(),
  VAPID_PRIVATE_KEY: z.string().min(30).optional(),
  VAPID_SUBJECT: z.string().default("mailto:info@jahonxabarlari.uz"),
  NEWS_AGGREGATOR_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  NEWS_AGGREGATOR_INTERVAL_MINUTES: z.coerce.number().min(1).default(5)
}).superRefine((value, ctx) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_REFRESH_SECRET"],
      message: "JWT_ACCESS_SECRET va JWT_REFRESH_SECRET har xil bo'lishi kerak"
    });
  }

  if (Boolean(value.VAPID_PUBLIC_KEY) !== Boolean(value.VAPID_PRIVATE_KEY)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [value.VAPID_PUBLIC_KEY ? "VAPID_PRIVATE_KEY" : "VAPID_PUBLIC_KEY"],
      message: "VAPID_PUBLIC_KEY va VAPID_PRIVATE_KEY birga sozlanishi kerak"
    });
  }
});

export const env = schema.parse(process.env);
export const apiPort = env.PORT ?? env.API_PORT ?? 4000;
export const frontendOrigins = [
  env.FRONTEND_URL,
  ...(env.FRONTEND_URLS?.split(",").map((item) => item.trim().replace(/\/+$/, "")).filter(Boolean) ?? [])
];
