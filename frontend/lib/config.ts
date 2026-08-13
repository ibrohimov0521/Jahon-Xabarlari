function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, "");
}

// Browser-side API URL. In Dokploy this can be a public API domain
// (https://api.jahonxabarlari.uz/api) or the local frontend proxy (/api).
export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "/api");

// Server-side API URL. Server-rendered pages, sitemap routes and build-time fetches cannot
// reliably use a relative /api URL, so they talk to the backend service directly by default.
export const SERVER_API_URL = normalizeApiUrl(
  process.env.INTERNAL_API_URL ??
    process.env.SERVER_API_URL ??
    (API_URL.startsWith("http")
      ? API_URL
      : process.env.NODE_ENV === "production"
        ? "http://backend:4000/api"
        : "http://localhost:4000/api")
);

export function apiUrl(path = "") {
  const base = typeof window === "undefined" ? SERVER_API_URL : API_URL;
  return `${base}${path}`;
}

// The API origin without the trailing /api, for building absolute media/asset URLs.
export const API_ORIGIN = API_URL.startsWith("http") ? API_URL.replace(/\/api$/, "") : "";
