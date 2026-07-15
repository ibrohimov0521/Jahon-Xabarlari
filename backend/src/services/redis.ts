import { Redis } from "ioredis";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false
  });
}

export function createBullConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null
  };
}

const lockRedis = createRedisConnection();
lockRedis.on("error", (error) => console.error("[redis] distributed lock xatosi:", error));

export async function withRedisLock<T>(key: string, ttlMs: number, task: () => Promise<T>): Promise<T | null> {
  const token = crypto.randomUUID();
  const acquired = await lockRedis.set(key, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") return null;
  let refreshing = false;
  const refreshTimer = setInterval(() => {
    if (refreshing) return;
    refreshing = true;
    void lockRedis
      .eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
        1,
        key,
        token,
        ttlMs
      )
      .catch((error) => console.error(`[redis] ${key} lock muddatini uzaytirib bo'lmadi:`, error))
      .finally(() => {
        refreshing = false;
      });
  }, Math.max(1_000, Math.floor(ttlMs / 3)));
  refreshTimer.unref();
  try {
    return await task();
  } finally {
    clearInterval(refreshTimer);
    await lockRedis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token
    ).catch(() => undefined);
  }
}

export async function closeRedisLockConnection() {
  await lockRedis.quit().catch(() => lockRedis.disconnect());
}

export async function pingRedis() {
  return lockRedis.ping();
}
