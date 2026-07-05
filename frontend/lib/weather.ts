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
