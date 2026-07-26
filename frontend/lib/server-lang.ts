import { cookies } from "next/headers";

export type RequestLanguage = "uz" | "ru" | "en";

export async function getRequestLang(explicit?: string | string[]): Promise<RequestLanguage> {
  const requested = Array.isArray(explicit) ? explicit[0] : explicit;
  if (requested === "uz" || requested === "ru" || requested === "en") return requested;
  const store = await cookies();
  const value = store.get("lang")?.value;
  return value === "ru" || value === "en" ? value : "uz";
}
