// Single source of truth for the backend API base URL. NEXT_PUBLIC_ vars are inlined at build
// time, so this constant is safe to import from both server and client components.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/+$/, "");

// The API origin without the trailing /api, for building absolute media/asset URLs.
export const API_ORIGIN = API_URL.startsWith("http") ? API_URL.replace(/\/api$/, "") : "";
