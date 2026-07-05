import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URLS: z.string().optional(),
  API_PORT: z.coerce.number().optional(),
  PORT: z.coerce.number().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  WEATHERAPI_API_KEY: z.string().optional(),
  NEWS_AGGREGATOR_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  NEWS_AGGREGATOR_INTERVAL_MINUTES: z.coerce.number().min(1).default(5),
  NEWS_AGGREGATOR_STATUS: z.enum(["PUBLISHED", "REVIEW", "DRAFT"]).default("PUBLISHED")
});

export const env = schema.parse(process.env);
export const apiPort = env.PORT ?? env.API_PORT ?? 4000;
export const frontendOrigins = [
  env.FRONTEND_URL,
  ...(env.FRONTEND_URLS?.split(",").map((item) => item.trim()).filter(Boolean) ?? [])
];
