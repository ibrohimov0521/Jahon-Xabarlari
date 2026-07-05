"use client";

import { ChevronDown, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CONDITION_GRADIENT,
  conditionLabel,
  fetchFullWeather,
  UZ_REGIONS,
  type FullWeather,
  type UzRegion,
  type WeatherCondition
} from "../lib/weather";

const WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

const CONDITION_ICON: Record<WeatherCondition, typeof Sun> = {
  clear: Sun,
  clouds: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning
};

function ConditionIcon({ condition, className }: { condition: WeatherCondition; className?: string }) {
  const Icon = CONDITION_ICON[condition];
  return <Icon className={className} />;
}

function formatHour(iso: string) {
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, "0")}:00`;
}

function dayLabel(iso: string, index: number) {
  if (index === 0) return "Bugun";
  const date = new Date(iso);
  return WEEKDAYS_SHORT[date.getDay()];
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
  const [weather, setWeather] = useState<FullWeather | null>(null);
  const [loading, setLoading] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchFullWeather(region.lat, region.lon).then((data) => {
      if (!cancelled) {
        setWeather(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, region]);

  if (!open) return null;

  const condition = weather?.condition ?? "clear";
  const gradient = CONDITION_GRADIENT[condition];

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 p-4 pt-20 sm:items-center sm:pt-4" onClick={onClose}>
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-b text-white shadow-2xl ${gradient}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Yopish" className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-1.5 backdrop-blur transition hover:bg-white/25">
          <X size={18} />
        </button>

        <div className="relative p-6">
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

          {loading && !weather && <p className="mt-8 text-white/80">Yuklanmoqda...</p>}

          {weather && (
            <>
              <div className="mt-4 flex items-center gap-4">
                <ConditionIcon condition={condition} className="h-16 w-16 shrink-0 text-amber-200 drop-shadow" />
                <div>
                  <p className="text-6xl font-black leading-none">{weather.temperature}°</p>
                  <p className="mt-1 text-lg font-bold">{conditionLabel(condition)}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/85">
                ↑{weather.todayMax}° / ↓{weather.todayMin}° &nbsp;•&nbsp; His qilinishi: {weather.feelsLike}°
              </p>

              <div className="mt-6 -mx-2 flex gap-4 overflow-x-auto px-2 pb-2">
                {weather.hourly.map((hour) => (
                  <div key={hour.time} className="flex shrink-0 flex-col items-center gap-2 text-center">
                    <span className="text-xs font-bold text-white/75">{formatHour(hour.time)}</span>
                    <ConditionIcon condition={hour.condition} className="h-6 w-6 text-amber-200" />
                    <span className="text-sm font-black">{hour.temp}°</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-white/10 p-3 backdrop-blur">
                {weather.daily.map((day, index) => (
                  <div key={day.date} className={`flex items-center justify-between gap-3 py-2 text-sm ${index > 0 ? "border-t border-white/10" : ""}`}>
                    <span className="w-16 shrink-0 font-bold">{dayLabel(day.date, index)}</span>
                    {day.precipitation > 0 && <span className="text-xs text-sky-200">💧{day.precipitation}%</span>}
                    <ConditionIcon condition={day.condition} className="ml-auto h-5 w-5 shrink-0 text-amber-200" />
                    <span className="w-20 shrink-0 text-right font-bold">
                      {day.max}° <span className="text-white/60">{day.min}°</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
