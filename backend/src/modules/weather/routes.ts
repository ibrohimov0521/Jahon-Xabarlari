import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";

export const weatherRouter = Router();

const CACHE_TTL_MS = 12 * 60 * 1000; // 10-15 min, per spec
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const alertsCache = new Map<string, { data: unknown; expiresAt: number }>();

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180)
});

// Only these OpenWeather map layers are proxyable -- an allowlist so the :layer param can't be
// used to reach an arbitrary path on OpenWeather's servers (or elsewhere, if ever refactored).
const TILE_LAYERS = new Set(["precipitation_new", "clouds_new", "temp_new", "wind_new", "pressure_new"]);

function cacheKey(lat: number, lon: number) {
  // Round to ~1km precision so nearby requests for the "same" city share a cache entry.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

weatherRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "lat/lon parametrlari noto'g'ri" });
  const { lat, lon } = parsed.data;

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,pressure_msl" +
      "&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max" +
      "&timezone=auto&forecast_days=16";

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();

    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
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
  const cached = alertsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const url =
      "https://api.weatherapi.com/v1/forecast.json" +
      `?key=${env.WEATHERAPI_API_KEY}&q=${lat},${lon}&days=1&alerts=yes&aqi=no`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WeatherAPI ${response.status}`);
    const data = await response.json();
    const result = { alerts: data?.alerts?.alert ?? [] };

    alertsCache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(result);
  } catch (error) {
    console.error("[weather] WeatherAPI so'rovi muvaffaqiyatsiz:", error instanceof Error ? error.message : error);
    // Alerts failing shouldn't break the rest of the panel -- degrade to "no alerts" instead
    // of surfacing an error for a non-critical, supplementary feature.
    res.json({ alerts: [] });
  }
});

// Proxies OpenWeather's map tiles (radar/precipitation/clouds/temp/wind overlays) so the API
// key stays server-side -- the browser only ever talks to our backend, never OpenWeather
// directly, consistent with how the main forecast is proxied above.
weatherRouter.get("/tile/:layer/:z/:x/:y", async (req, res) => {
  const { layer, z: zoom, x, y } = req.params;
  if (!TILE_LAYERS.has(layer)) return res.status(400).json({ message: "Noto'g'ri xarita qatlami" });
  if (!env.OPENWEATHER_API_KEY) return res.status(503).json({ message: "Xarita xizmati sozlanmagan" });

  try {
    const url = `https://tile.openweathermap.org/map/${layer}/${zoom}/${x}/${y}.png?appid=${env.OPENWEATHER_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OpenWeather tile ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=600");
    res.send(buffer);
  } catch (error) {
    console.error("[weather] Xarita qatlamini olishda xatolik:", error instanceof Error ? error.message : error);
    res.status(502).end();
  }
});
