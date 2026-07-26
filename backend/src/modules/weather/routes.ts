import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";

export const weatherRouter = Router();

const CACHE_TTL_MS = 12 * 60 * 1000; // 10-15 min, per spec
const CACHE_MAX_ENTRIES = 500;
type CacheEntry = { data: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const alertsCache = new Map<string, CacheEntry>();
const forecastInFlight = new Map<string, Promise<unknown>>();
const alertsInFlight = new Map<string, Promise<unknown>>();

weatherRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Ob-havo so'rovlari juda ko'p yuborildi" }
  })
);

// Both Maps are keyed by rounded lat/lon, so distinct visitor locations accumulate entries
// forever with no eviction otherwise -- sweep out anything past its TTL periodically instead.
function sweepExpired(map: Map<string, { expiresAt: number }>) {
  const now = Date.now();
  for (const [key, value] of map) {
    if (value.expiresAt <= now) map.delete(key);
  }
}
setInterval(() => {
  sweepExpired(cache);
  sweepExpired(alertsCache);
}, CACHE_TTL_MS).unref();

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180)
});

function cacheKey(lat: number, lon: number) {
  // Round to ~1km precision so nearby requests for the "same" city share a cache entry.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function putCache(map: Map<string, CacheEntry>, key: string, data: unknown) {
  while (map.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = map.keys().next().value as string | undefined;
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
  map.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function loadCached(
  key: string,
  map: Map<string, CacheEntry>,
  inFlight: Map<string, Promise<unknown>>,
  loader: () => Promise<unknown>
) {
  const cached = map.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = loader()
    .then((data) => {
      putCache(map, key, data);
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

weatherRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "lat/lon parametrlari noto'g'ri" });
  const { lat, lon } = parsed.data;

  const key = cacheKey(lat, lon);
  try {
    const data = await loadCached(key, cache, forecastInFlight, async () => {
      const url =
        "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${lat}&longitude=${lon}` +
        "&current=temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,pressure_msl" +
        "&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m,is_day" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max" +
        "&timezone=auto&forecast_days=16";

      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
      return response.json();
    });
    res.json(data);
  } catch (error) {
    console.error("[weather] Open-Meteo so'rovi muvaffaqiyatsiz:", error instanceof Error ? error.message : error);
    res.status(502).json({ message: "Ob-havo ma'lumotlarini olishda xatolik" });
  }
});

// Severe weather alerts via WeatherAPI. Gracefully returns an empty list (not an error) when
// the key isn't configured, since alerts are a supplementary feature on top of the core
// Open-Meteo forecast, not something the rest of the panel depends on.
weatherRouter.get("/alerts", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "lat/lon parametrlari noto'g'ri" });
  const { lat, lon } = parsed.data;

  if (!env.WEATHERAPI_API_KEY) return res.json({ alerts: [] });

  const key = cacheKey(lat, lon);
  try {
    const result = await loadCached(key, alertsCache, alertsInFlight, async () => {
      const url =
        "https://api.weatherapi.com/v1/forecast.json" +
        `?key=${env.WEATHERAPI_API_KEY}&q=${lat},${lon}&days=1&alerts=yes&aqi=no`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`WeatherAPI ${response.status}`);
      const data = (await response.json()) as { alerts?: { alert?: unknown[] } };
      return { alerts: data.alerts?.alert ?? [] };
    });
    res.json(result);
  } catch (error) {
    console.error("[weather] WeatherAPI so'rovi muvaffaqiyatsiz:", error instanceof Error ? error.message : error);
    // Alerts failing shouldn't break the rest of the panel -- degrade to "no alerts" instead
    // of surfacing an error for a non-critical, supplementary feature.
    res.json({ alerts: [] });
  }
});
