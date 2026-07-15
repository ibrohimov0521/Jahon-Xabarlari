import { NextRequest, NextResponse } from "next/server";

type Language = "uz" | "ru" | "en";

function isLanguage(value: string | null | undefined): value is Language {
  return value === "uz" || value === "ru" || value === "en";
}

function detectLanguage(request: NextRequest): Language {
  const requested = request.nextUrl.searchParams.get("lang");
  if (isLanguage(requested)) return requested;

  const saved = request.cookies.get("lang")?.value;
  if (isLanguage(saved)) return saved;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (/bot|crawler|spider|google|bing|yandex/i.test(userAgent)) return "uz";

  const accepted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((item) => item.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const language of accepted) {
    if (language === "uz" || language?.startsWith("uz-")) return "uz";
    if (language === "ru" || language?.startsWith("ru-")) return "ru";
    if (language === "en" || language?.startsWith("en-")) return "en";
  }

  return "en";
}

export function proxy(request: NextRequest) {
  const language = detectLanguage(request);
  const requestHeaders = new Headers(request.headers);
  const cookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("lang="));
  cookies.push(`lang=${language}`);
  requestHeaders.set("cookie", cookies.join("; "));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set("lang", language, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  response.headers.append("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"]
};
