import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  API_PORT: z.coerce.number().optional(),
  PORT: z.coerce.number().optional()
});

export const env = schema.parse(process.env);
export const apiPort = env.PORT ?? env.API_PORT ?? 4000;
