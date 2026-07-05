"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { MAP_LAYERS, tileUrlTemplate, type MapLayer } from "../lib/weather";

export function RadarMap({ lat, lon }: { lat: number; lon: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [layer, setLayer] = useState<MapLayer>("precipitation_new");

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap"
          }
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      },
      center: [lon, lat],
      zoom: 6,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setCenter([lon, lat]);
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyOverlay = () => {
      if (map.getLayer("weather-overlay")) map.removeLayer("weather-overlay");
      if (map.getSource("weather-overlay")) map.removeSource("weather-overlay");
      map.addSource("weather-overlay", {
        type: "raster",
        tiles: [tileUrlTemplate(layer)],
        tileSize: 256
      });
      map.addLayer({ id: "weather-overlay", type: "raster", source: "weather-overlay", paint: { "raster-opacity": 0.6 } });
    };
    if (map.isStyleLoaded()) applyOverlay();
    else map.once("load", applyOverlay);
  }, [layer]);

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/60">Radar va xaritalar</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {MAP_LAYERS.map((item) => (
          <button
            key={item.id}
            onClick={() => setLayer(item.id)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              layer === item.id ? "bg-amber-400 text-ink" : "bg-white/12 text-white/80 hover:bg-white/20"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-2xl" />
    </div>
  );
}
