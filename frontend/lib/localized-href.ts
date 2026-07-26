export type SiteLanguage = "uz" | "ru" | "en";

export function localizedHref(path: string, language: SiteLanguage): string {
  if (!path.startsWith("/")) return path;

  const url = new URL(path, "https://jahonxabarlari.uz");
  if (language === "uz") {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", language);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
