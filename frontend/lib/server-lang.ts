import { cookies } from "next/headers";

export async function getRequestLang(): Promise<"uz" | "ru" | "en"> {
  const store = await cookies();
  const value = store.get("lang")?.value;
  return value === "ru" || value === "en" ? value : "uz";
}
