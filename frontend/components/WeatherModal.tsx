"use client";

import { AlertTriangle, ChevronDown, Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, Gauge, Moon, Sun, Wind, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUi } from "../lib/ui-context";
import {
  conditionGradient,
  conditionLabel,
  fetchFullWeather,
  fetchWeatherAlerts,
  weatherBackgroundImage,
  UZ_REGIONS,
  type FullWeather,
  type UzRegion,
  type WeatherAlert,
  type WeatherCondition
} from "../lib/weather";

const CYRILLIC_PATTERN = /[Ѐ-ӿ]/;

// WeatherAPI issues each regional alert twice -- once in Russian, once in English -- with no
// language field to tell them apart, so we detect script directly. The site has no Uzbek-
// language alert source, so Uzbek/English UI both fall back to the English copies.
function filterAlertsByLanguage(alerts: WeatherAlert[], language: "uz" | "ru" | "en") {
  const wantsCyrillic = language === "ru";
  return alerts.filter((alert) => CYRILLIC_PATTERN.test(alert.event || alert.headline || "") === wantsCyrillic);
}

const WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

// Day/night icon variants per condition (clear/partly-cloudy look meaningfully different at
// night; the rest read fine either way but a moon-tinted set would be overkill).
const CONDITION_ICON: Record<WeatherCondition, { day: typeof Sun; night: typeof Sun }> = {
  clear: { day: Sun, night: Moon },
  partlyCloudy: { day: CloudSun, night: CloudMoon },
  clouds: { day: Cloud, night: Cloud },
  fog: { day: CloudFog, night: CloudFog },
  rain: { day: CloudRain, night: CloudRain },
  snow: { day: CloudSnow, night: CloudSnow },
  storm: { day: CloudLightning, night: CloudLightning }
};

function ConditionIcon({ condition, isDay = true, className }: { condition: WeatherCondition; isDay?: boolean; className?: string }) {
  const Icon = isDay ? CONDITION_ICON[condition].day : CONDITION_ICON[condition].night;
  return <Icon className={className} />;
}

function formatHour(iso: string) {
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, "0")}:00`;
}

function formatClock(iso: string) {
  if (!iso) return "--:--";
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function dayLabel(iso: string, index: number) {
  if (index === 0) return "Bugun";
  if (index === 1) return "Ertaga";
  const date = new Date(iso);
  return WEEKDAYS_SHORT[date.getDay()];
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/12 p-3 text-center backdrop-blur-md">
      <span className="text-amber-200">{icon}</span>
      <span className="text-base font-black">{value}</span>
      <span className="text-[11px] text-white/70">{label}</span>
    </div>
  );
}

export function WeatherModal({
  open,
  onClose,
  region,
  regions,
  onSelectRegion
}: {
  open: boolean;
  onClose: () => void;
  region: UzRegion;
  regions: UzRegion[];
  onSelectRegion: (region: UzRegion) => void;
}) {
  const { language } = useUi();
  const [weather, setWeather] = useState<FullWeather | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const visibleAlerts = useMemo(() => filterAlertsByLanguage(alerts, language), [alerts, language]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    // Clear the previous region's data immediately -- otherwise it stays on screen (looking
    // current) for the entire loading window after switching regions.
    setWeather(null);
    setAlerts([]);
    fetchFullWeather(region.lat, region.lon).then((data) => {
      if (cancelled) return;
      if (!data) setError("Ob-havo ma'lumotlarini olishda xatolik");
      setWeather(data);
      setLoading(false);
    });
    fetchWeatherAlerts(region.lat, region.lon).then((data) => {
      if (!cancelled) setAlerts(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, region]);

  if (!open) return null;

  const condition = weather?.condition ?? "clear";
  const isDay = weather?.isDay ?? true;
  const gradient = conditionGradient(condition, isDay);
  const backgroundImage = weatherBackgroundImage(weather);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 sm:items-center sm:pt-4" onClick={onClose}>
      <div className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b text-white shadow-2xl ${gradient}`} onClick={(event) => event.stopPropagation()}>
        <div
          key={backgroundImage}
          className="weather-modal-bg absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/28 to-black/70" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,rgba(255,255,255,0.22),transparent_28rem)]" aria-hidden="true" />
        <button onClick={onClose} aria-label="Yopish" className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-1.5 backdrop-blur transition hover:bg-white/25">
          <X size={18} />
        </button>

        <div className="relative z-[1] max-h-[85vh] overflow-y-auto p-6">
          <div className="relative inline-block">
            <button onClick={() => setRegionPickerOpen((value) => !value)} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">
              📍 {region.name} <ChevronDown size={14} />
            </button>
            {regionPickerOpen && (
              <div className="absolute left-0 top-10 z-20 max-h-64 w-52 overflow-y-auto rounded-xl border border-white/10 bg-ink/95 p-1 text-left shadow-2xl backdrop-blur">
                {regions.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      onSelectRegion(item);
                      setRegionPickerOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-white/10 ${item.name === region.name ? "text-amber-300" : "text-white"}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visibleAlerts.length > 0 && (
            <div className="mt-4 space-y-2">
              {visibleAlerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-2 rounded-2xl border border-red-300/40 bg-red-500/25 p-3 text-sm backdrop-blur-md">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-100" />
                  <div>
                    <p className="font-black text-red-50">{alert.event || alert.headline || "Ob-havo ogohlantirishi"}</p>
                    {alert.desc && <p className="mt-0.5 text-xs text-red-100/90">{alert.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && !weather && <p className="mt-8 text-white/80">Yuklanmoqda...</p>}
          {error && <p className="mt-8 rounded-xl bg-red-500/20 px-4 py-3 text-sm font-bold text-red-100">{error}</p>}

          {weather && (
            <>
              <div className="mt-4 flex items-center gap-4">
                <ConditionIcon condition={condition} isDay={isDay} className="h-16 w-16 shrink-0 text-amber-200 drop-shadow" />
                <div>
                  <p className="text-6xl font-black leading-none">{weather.temperature}°</p>
                  <p className="mt-1 text-lg font-bold">{conditionLabel(condition)}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/85">
                ↑{weather.todayMax}° / ↓{weather.todayMin}° &nbsp;•&nbsp; His qilinishi: {weather.feelsLike}°
              </p>

              {/* Current conditions -- glass stat cards */}
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <StatCard icon={<Wind size={18} />} label="Shamol" value={`${weather.windSpeed} km/s`} />
                <StatCard icon={<Droplets size={18} />} label="Namlik" value={`${weather.humidity}%`} />
                <StatCard icon={<Gauge size={18} />} label="Bosim" value={`${weather.pressure} hPa`} />
                <StatCard icon={<Sun size={18} />} label="UV indeks" value={`${weather.todayUvIndex}`} />
                <StatCard icon={<CloudRain size={18} />} label="Yog'ingarchilik" value={`${weather.hourly[0]?.precipitation ?? 0}%`} />
              </div>

              {/* 48-hour forecast -- horizontal scroll */}
              <div className="mt-6">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/60">48 soatlik prognoz</p>
                <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2">
                  {weather.hourly.map((hour) => (
                    <div key={hour.time} className="flex shrink-0 flex-col items-center gap-2 text-center">
                      <span className="text-xs font-bold text-white/75">{formatHour(hour.time)}</span>
                      <ConditionIcon condition={hour.condition} isDay={hour.isDay} className="h-6 w-6 text-amber-200" />
                      <span className="text-sm font-black">{hour.temp}°</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 15/16-day forecast -- its own separate glass card */}
              <div className="mt-5 rounded-2xl bg-white/12 p-3 backdrop-blur-md">
                <p className="mb-1 px-1 text-xs font-black uppercase tracking-wide text-white/60">16 kunlik prognoz</p>
                {weather.daily.map((day, index) => (
                  <div key={day.date} className={`flex items-center justify-between gap-3 py-2 text-sm ${index > 0 ? "border-t border-white/10" : ""}`}>
                    <span className="w-16 shrink-0 font-bold">{dayLabel(day.date, index)}</span>
                    {day.precipitation > 0 ? <span className="w-12 shrink-0 text-xs text-sky-200">💧{day.precipitation}%</span> : <span className="w-12 shrink-0" />}
                    <ConditionIcon condition={day.condition} className="ml-auto h-5 w-5 shrink-0 text-amber-200" />
                    <span className="w-20 shrink-0 text-right font-bold">
                      {day.max}° <span className="text-white/60">{day.min}°</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/12 p-3 text-sm backdrop-blur-md">
                <span>🌅 Quyosh chiqishi: {formatClock(weather.sunrise)}</span>
                <span>🌇 Botishi: {formatClock(weather.sunset)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
