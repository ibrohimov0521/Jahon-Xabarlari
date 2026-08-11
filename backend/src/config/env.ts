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
const optionalEnv = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => typeof value === "string" && !value.trim() ? undefined : value, schema.optional());

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
  // A malformed optional visual setting must never prevent the newsroom backend from starting.
  TELEGRAM_CHANNEL_CUSTOM_EMOJI_ID: z.string().trim().optional(),
  // Telegram requires the original Unicode alternative paired with a custom emoji ID.
  TELEGRAM_CHANNEL_CUSTOM_EMOJI_ALT: z.string().trim().max(16).optional(),
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
  // Instagram publishing uses the official Meta Graph API. It remains disabled until all
  // credentials are present, so publishing ordinary news never depends on Meta availability.
  INSTAGRAM_POSTING_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  INSTAGRAM_ACCESS_TOKEN: optionalEnv(z.string().trim().min(20)),
  INSTAGRAM_USER_ID: optionalEnv(z.string().trim().regex(/^\d+$/, "INSTAGRAM_USER_ID faqat raqamlardan iborat bo'lishi kerak")),
  // Meta has two Instagram API products with different Graph hosts. New apps using
  // "Instagram Login" receive IGA... tokens and must use graph.instagram.com.
  INSTAGRAM_API_MODE: z.enum(["instagram_login", "facebook_login"]).default("instagram_login"),
  INSTAGRAM_GRAPH_API_VERSION: z.string().trim().regex(/^v\d+\.\d+$/, "Masalan v24.0").default("v24.0"),
  INSTAGRAM_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(3).default(2),
  // Meta fetches the asset itself. This must be the public HTTPS URL of the backend service,
  // not a private Railway hostname or localhost.
  BACKEND_PUBLIC_URL: optionalEnv(webOrigin),
  // Video branding runs in the isolated media-renderer service. Keeping ffmpeg away from the
  // newsroom API prevents one large video from blocking articles, the bot, or the aggregator.
  MEDIA_RENDERER_URL: optionalEnv(z.string().trim().url()),
  MEDIA_RENDERER_SECRET: optionalEnv(z.string().trim().min(32)),
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

  if (value.TELEGRAM_CHANNEL_POSTING_ENABLED && (!value.TELEGRAM_CHANNEL_BOT_TOKEN || !value.TELEGRAM_NEWS_CHANNEL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: !value.TELEGRAM_CHANNEL_BOT_TOKEN ? ["TELEGRAM_CHANNEL_BOT_TOKEN"] : ["TELEGRAM_NEWS_CHANNEL"],
      message: "Telegram kanalga yuborish uchun bot tokeni va kanal manzili birga sozlanishi kerak"
    });
  }

  if (value.INSTAGRAM_POSTING_ENABLED) {
    const missingKey = !value.INSTAGRAM_ACCESS_TOKEN
      ? "INSTAGRAM_ACCESS_TOKEN"
      : !value.INSTAGRAM_USER_ID
        ? "INSTAGRAM_USER_ID"
        : !value.BACKEND_PUBLIC_URL
          ? "BACKEND_PUBLIC_URL"
          : null;
    if (missingKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [missingKey],
        message: "Instagramga yuborish uchun access token, Instagram user ID va public HTTPS backend manzili kerak"
      });
    } else if (new URL(value.BACKEND_PUBLIC_URL!).protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BACKEND_PUBLIC_URL"],
        message: "Instagram Meta public media fayllarini olishi uchun BACKEND_PUBLIC_URL https:// bilan boshlanishi kerak"
      });
    }
  }

  if (Boolean(value.MEDIA_RENDERER_URL) !== Boolean(value.MEDIA_RENDERER_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: value.MEDIA_RENDERER_URL ? ["MEDIA_RENDERER_SECRET"] : ["MEDIA_RENDERER_URL"],
      message: "MEDIA_RENDERER_URL va MEDIA_RENDERER_SECRET birga sozlanishi kerak"
    });
  }
});

export const env = schema.parse(process.env);
export const apiPort = env.PORT ?? env.API_PORT ?? 4000;
export const frontendOrigins = [
  env.FRONTEND_URL,
  ...(env.FRONTEND_URLS?.split(",").map((item) => item.trim().replace(/\/+$/, "")).filter(Boolean) ?? [])
];
