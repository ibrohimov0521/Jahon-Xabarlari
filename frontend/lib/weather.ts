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

export async function fetchTemperature(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    return typeof temp === "number" ? Math.round(temp) : null;
  } catch {
    return null;
  }
}

export type WeatherCondition = "clear" | "clouds" | "fog" | "rain" | "snow" | "storm";

// WMO weather codes, as returned by Open-Meteo. https://open-meteo.com/en/docs
export function codeToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "clouds";
}

// Uzbek description shown under the current temperature (matches the reference design).
export function conditionLabel(condition: WeatherCondition): string {
  return {
    clear: "Musaffo",
    clouds: "Bulutli",
    fog: "Tumanli",
    rain: "Yomg'irli",
    snow: "Qorli",
    storm: "Momaqaldiroqli"
  }[condition];
}

// Tailwind gradient classes per condition, used as the weather modal's dynamic background.
export const CONDITION_GRADIENT: Record<WeatherCondition, string> = {
  clear: "from-sky-400 via-sky-500 to-emerald-400",
  clouds: "from-slate-400 via-slate-500 to-slate-600",
  fog: "from-slate-300 via-slate-400 to-slate-500",
  rain: "from-slate-600 via-slate-700 to-slate-900",
  snow: "from-sky-100 via-sky-200 to-slate-300",
  storm: "from-slate-800 via-indigo-900 to-slate-900"
};

export type HourPoint = { time: string; temp: number; condition: WeatherCondition; precipitation: number };
export type DayPoint = { date: string; max: number; min: number; condition: WeatherCondition; precipitation: number };

export type FullWeather = {
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  todayMax: number;
  todayMin: number;
  hourly: HourPoint[];
  daily: DayPoint[];
};

export async function fetchFullWeather(lat: number, lon: number): Promise<FullWeather | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        "&current=temperature_2m,apparent_temperature,weathercode" +
        "&hourly=temperature_2m,weathercode,precipitation_probability" +
        "&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max" +
        "&timezone=auto&forecast_days=8"
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.current || !data?.hourly || !data?.daily) return null;

    const startIdx = Math.max(0, data.hourly.time.indexOf(data.current.time));
    const hourly: HourPoint[] = data.hourly.time.slice(startIdx, startIdx + 12).map((time: string, i: number) => ({
      time,
      temp: Math.round(data.hourly.temperature_2m[startIdx + i]),
      condition: codeToCondition(data.hourly.weathercode[startIdx + i]),
      precipitation: data.hourly.precipitation_probability?.[startIdx + i] ?? 0
    }));
    const daily: DayPoint[] = data.daily.time.map((date: string, i: number) => ({
      date,
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
      condition: codeToCondition(data.daily.weathercode[i]),
      precipitation: data.daily.precipitation_probability_max?.[i] ?? 0
    }));

    return {
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      condition: codeToCondition(data.current.weathercode),
      todayMax: daily[0]?.max ?? Math.round(data.current.temperature_2m),
      todayMin: daily[0]?.min ?? Math.round(data.current.temperature_2m),
      hourly,
      daily
    };
  } catch {
    return null;
  }
}
