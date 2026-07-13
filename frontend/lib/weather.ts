import { timeoutSignal } from "./http";

export type UzRegion = { name: string; lat: number; lon: number };

// All 12 viloyat + Toshkent shahri + Qoraqalpog'iston Respublikasi (regional center coords).
export const UZ_REGIONS: UzRegion[] = [
  { name: "Toshkent", lat: 41.2995, lon: 69.2401 },
  { name: "Andijon", lat: 40.7821, lon: 72.3442 },
  { name: "Buxoro", lat: 39.7747, lon: 64.4286 },
  { name: "Farg'ona", lat: 40.3894, lon: 71.7843 },
  { name: "Jizzax", lat: 40.1158, lon: 67.8422 },
  { name: "Namangan", lat: 40.9983, lon: 71.6726 },
  { name: "Navoiy", lat: 40.1030, lon: 65.3686 },
  { name: "Nukus (Qoraqalpog'iston)", lat: 42.4600, lon: 59.6100 },
  { name: "Qarshi (Qashqadaryo)", lat: 38.8606, lon: 65.7891 },
  { name: "Samarqand", lat: 39.6270, lon: 66.9750 },
  { name: "Guliston (Sirdaryo)", lat: 40.4897, lon: 68.7842 },
  { name: "Termiz (Surxondaryo)", lat: 37.2242, lon: 67.2783 },
  { name: "Urganch (Xorazm)", lat: 41.5506, lon: 60.6317 }
];

function haversineKm(a: UzRegion, lat: number, lon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat - a.lat);
  const dLon = toRad(lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(lat)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestRegion(lat: number, lon: number): UzRegion {
  return UZ_REGIONS.reduce((closest, region) => (haversineKm(region, lat, lon) < haversineKm(closest, lat, lon) ? region : closest), UZ_REGIONS[0]);
}

export function findRegionByName(name: string): UzRegion {
  return UZ_REGIONS.find((region) => region.name === name) ?? UZ_REGIONS[0];
}

export type WeatherCondition = "clear" | "partlyCloudy" | "clouds" | "fog" | "rain" | "snow" | "storm";

// WMO weather codes, as returned by Open-Meteo. https://open-meteo.com/en/docs
export function codeToCondition(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partlyCloudy";
  if (code === 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "clouds";
}

export function conditionLabel(condition: WeatherCondition): string {
  return {
    clear: "Musaffo",
    partlyCloudy: "Qisman bulutli",
    clouds: "Bulutli",
    fog: "Tuman",
    rain: "Yomg'ir",
    snow: "Qor",
    storm: "Momaqaldiroq"
  }[condition];
}

// Tailwind gradient classes for the weather modal's dynamic background, day vs night variants.
export function conditionGradient(condition: WeatherCondition, isDay: boolean): string {
  const day: Record<WeatherCondition, string> = {
    clear: "from-sky-400 via-sky-500 to-emerald-400",
    partlyCloudy: "from-sky-300 via-slate-400 to-slate-500",
    clouds: "from-slate-400 via-slate-500 to-slate-600",
    fog: "from-slate-300 via-slate-400 to-slate-500",
    rain: "from-slate-600 via-slate-700 to-slate-900",
    snow: "from-sky-100 via-sky-200 to-slate-300",
    storm: "from-slate-800 via-indigo-900 to-slate-900"
  };
  const night: Record<WeatherCondition, string> = {
    clear: "from-indigo-950 via-slate-900 to-black",
    partlyCloudy: "from-indigo-900 via-slate-800 to-slate-950",
    clouds: "from-slate-700 via-slate-800 to-slate-950",
    fog: "from-slate-600 via-slate-700 to-slate-900",
    rain: "from-slate-800 via-slate-900 to-black",
    snow: "from-slate-500 via-slate-700 to-slate-900",
    storm: "from-slate-900 via-indigo-950 to-black"
  };
  return (isDay ? day : night)[condition];
}

const WEATHER_BACKGROUNDS = {
  clearDay: ["/weather/clear-day-meadow.jpg", "/weather/clear-day-lake.jpg"],
  clearNight: ["/weather/clear-night-stars.jpg"],
  partlyCloudyDay: ["/weather/partly-sunset-hills.jpg", "/weather/sunset-sea.jpg"],
  partlyCloudyNight: ["/weather/clear-night-stars.jpg"],
  clouds: ["/weather/cloudy-valley.jpg"],
  fog: ["/weather/fog-valley.jpg", "/weather/mist-road.jpg"],
  rainDay: ["/weather/rain-valley.jpg", "/weather/rain-promenade.jpg"],
  rainNight: ["/weather/heavy-rain-night.jpg"],
  snow: ["/weather/snow-mountain.jpg"],
  storm: ["/weather/storm-lightning.jpg", "/weather/hail-storm.jpg"],
  wind: ["/weather/windy-hill.jpg"]
} as const;

function stableImage(list: readonly string[], seed: string | number) {
  if (list.length === 1) return list[0];
  const text = String(seed);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

function isNearSunset(nowIso: string | undefined, sunsetIso: string | undefined) {
  if (!nowIso || !sunsetIso) return false;
  const now = new Date(nowIso).getTime();
  const sunset = new Date(sunsetIso).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(sunset)) return false;
  return Math.abs(sunset - now) <= 90 * 60 * 1000;
}

export function weatherBackgroundImage(weather: Pick<FullWeather, "condition" | "isDay" | "windSpeed" | "precipitation" | "hourly" | "sunset"> | null): string {
  if (!weather) return WEATHER_BACKGROUNDS.clearDay[0];

  const seed = weather.hourly?.[0]?.time ?? `${weather.condition}-${weather.isDay}`;

  if (weather.windSpeed >= 45 && weather.condition !== "rain" && weather.condition !== "snow" && weather.condition !== "storm") {
    return WEATHER_BACKGROUNDS.wind[0];
  }

  if (weather.condition === "storm") {
    const stormList = weather.precipitation > 0 ? WEATHER_BACKGROUNDS.storm : [WEATHER_BACKGROUNDS.storm[0]];
    return stableImage(stormList, seed);
  }
  if (weather.condition === "snow") return WEATHER_BACKGROUNDS.snow[0];
  if (weather.condition === "rain") return stableImage(weather.isDay ? WEATHER_BACKGROUNDS.rainDay : WEATHER_BACKGROUNDS.rainNight, seed);
  if (weather.condition === "fog") return stableImage(WEATHER_BACKGROUNDS.fog, seed);
  if (weather.condition === "clouds") return WEATHER_BACKGROUNDS.clouds[0];
  if (weather.condition === "partlyCloudy") {
    return stableImage(weather.isDay ? WEATHER_BACKGROUNDS.partlyCloudyDay : WEATHER_BACKGROUNDS.partlyCloudyNight, seed);
  }
  if (!weather.isDay) return WEATHER_BACKGROUNDS.clearNight[0];
  if (isNearSunset(weather.hourly?.[0]?.time, weather.sunset)) return "/weather/sunset-sea.jpg";
  return stableImage(WEATHER_BACKGROUNDS.clearDay, seed);
}

export type HourPoint = {
  time: string;
  temp: number;
  feelsLike: number;
  condition: WeatherCondition;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
};

export type DayPoint = {
  date: string;
  max: number;
  min: number;
  condition: WeatherCondition;
  precipitation: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
};

export type FullWeather = {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  isDay: boolean;
  humidity: number;
  windSpeed: number;
  pressure: number;
  precipitation: number;
  todayMax: number;
  todayMin: number;
  todayUvIndex: number;
  sunrise: string;
  sunset: string;
  hourly: HourPoint[];
  daily: DayPoint[];
};

export type WeatherAlert = {
  headline: string;
  severity: string;
  event: string;
  desc: string;
  effective: string;
  expires: string;
};

import { API_URL } from "./config";

// Severe weather alerts, proxied through our backend (WeatherAPI). Degrades to an empty list on
// any failure -- alerts are a bonus banner on top of the core forecast, never a blocker.
export async function fetchWeatherAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
  try {
    const res = await fetch(`${API_URL}/weather/alerts?lat=${lat}&lon=${lon}`, { signal: timeoutSignal() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.alerts) ? data.alerts : [];
  } catch {
    return [];
  }
}

// Fetched via our own backend (which proxies + caches Open-Meteo for 10-15 min) rather than
// calling Open-Meteo directly from the browser, per the requested architecture.
export async function fetchFullWeather(lat: number, lon: number): Promise<FullWeather | null> {
  try {
    const res = await fetch(`${API_URL}/weather?lat=${lat}&lon=${lon}`, { signal: timeoutSignal() });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.current || !data?.hourly || !data?.daily) return null;

    const startIdx = Math.max(0, data.hourly.time.indexOf(data.current.time));
    const hourly: HourPoint[] = data.hourly.time.slice(startIdx, startIdx + 48).map((time: string, i: number) => {
      const idx = startIdx + i;
      return {
        time,
        temp: Math.round(data.hourly.temperature_2m[idx]),
        feelsLike: Math.round(data.hourly.apparent_temperature[idx]),
        condition: codeToCondition(data.hourly.weather_code[idx]),
        precipitation: data.hourly.precipitation_probability?.[idx] ?? 0,
        humidity: data.hourly.relative_humidity_2m?.[idx] ?? 0,
        windSpeed: Math.round(data.hourly.wind_speed_10m?.[idx] ?? 0),
        isDay: Boolean(data.hourly.is_day?.[idx] ?? 1)
      };
    });

    const daily: DayPoint[] = data.daily.time.map((date: string, i: number) => ({
      date,
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
      condition: codeToCondition(data.daily.weather_code[i]),
      precipitation: data.daily.precipitation_probability_max?.[i] ?? 0,
      uvIndex: Math.round(data.daily.uv_index_max?.[i] ?? 0),
      sunrise: data.daily.sunrise?.[i] ?? "",
      sunset: data.daily.sunset?.[i] ?? ""
    }));

    return {
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      condition: codeToCondition(data.current.weather_code),
      isDay: Boolean(data.current.is_day),
      humidity: Math.round(data.current.relative_humidity_2m ?? 0),
      windSpeed: Math.round(data.current.wind_speed_10m ?? 0),
      pressure: Math.round(data.current.pressure_msl ?? 0),
      precipitation: data.current.precipitation ?? 0,
      todayMax: daily[0]?.max ?? Math.round(data.current.temperature_2m),
      todayMin: daily[0]?.min ?? Math.round(data.current.temperature_2m),
      todayUvIndex: daily[0]?.uvIndex ?? 0,
      sunrise: daily[0]?.sunrise ?? "",
      sunset: daily[0]?.sunset ?? "",
      hourly,
      daily
    };
  } catch {
    return null;
  }
}
