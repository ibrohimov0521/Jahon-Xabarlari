import type { Metadata, Viewport } from "next";
import { ArticleModal } from "../components/ArticleModal";
import { Analytics } from "../components/Analytics";
import BottomNav from "../components/BottomNav";
import { MobileCurrencyExperience } from "../components/MobileCurrency";
import SearchExperience from "../components/SearchExperience";
import { SiteFooter } from "../components/SiteFooter";
import SwipeNav from "../components/SwipeNav";
import { PushNotifications } from "../components/PushNotifications";
import { serializeJsonLd } from "../lib/json-ld";
import { NavProvider } from "../lib/nav-context";
import { SearchProvider } from "../lib/search-context";
import { getRequestLang } from "../lib/server-lang";
import { UiProvider } from "../lib/ui-context";
import { SITE_ALTERNATE_NAME, SITE_DESCRIPTION, SITE_FULL_NAME, SITE_KEYWORDS, SITE_LOGO_SQUARE, SITE_NAME, SITE_OG_IMAGE, SITE_SOCIAL_LINKS, SITE_TITLE, SITE_URL } from "../lib/site";
import "./globals.css";

const localizedSeo = {
  uz: { title: SITE_TITLE, description: SITE_DESCRIPTION, locale: "uz_UZ" },
  ru: {
    title: "Jahon Xabarlari — новости Узбекистана и мира",
    description: "Последние новости Узбекистана и мира: политика, экономика, технологии, спорт и культура.",
    locale: "ru_RU"
  },
  en: {
    title: "Jahon Xabarlari — Uzbekistan and World News",
    description: "Latest news from Uzbekistan and around the world, including politics, business, technology, sport and culture.",
    locale: "en_US"
  }
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getRequestLang();
  const seo = localizedSeo[lang];
  const canonical = `${SITE_URL}/`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: seo.title, template: `%s | ${SITE_NAME}` },
    description: seo.description,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_FULL_NAME,
    authors: [{ name: SITE_FULL_NAME, url: SITE_URL }],
    creator: SITE_FULL_NAME,
    publisher: SITE_FULL_NAME,
    referrer: "origin-when-cross-origin",
    formatDetection: { email: false, address: false, telephone: false },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
        { url: SITE_LOGO_SQUARE, sizes: "512x512", type: "image/png" }
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"]
    },
    appleWebApp: { capable: true, title: SITE_FULL_NAME, statusBarStyle: "black-translucent" },
    alternates: {
      canonical,
      languages: {
        uz: canonical,
        ru: `${SITE_URL}/?lang=ru`,
        en: `${SITE_URL}/?lang=en`,
        "x-default": canonical
      }
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: SITE_NAME,
      locale: seo.locale,
      alternateLocale: ["uz_UZ", "ru_RU", "en_US"].filter((locale) => locale !== seo.locale),
      type: "website",
      images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: SITE_FULL_NAME }]
    },
    twitter: {
      card: "summary_large_image",
      site: "@jahonxabarlari",
      creator: "@jahonxabarlari",
      title: seo.title,
      description: seo.description,
      images: [SITE_OG_IMAGE]
    },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
    category: "news"
  };
}

export const viewport: Viewport = {
  themeColor: "#07132f",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getRequestLang();
  return (
    <html lang={lang} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Analytics />
        <div className="site-backdrop" aria-hidden="true" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "NewsMediaOrganization",
              "@id": `${SITE_URL}/#organization`,
              name: SITE_NAME,
              legalName: SITE_FULL_NAME,
              alternateName: [SITE_ALTERNATE_NAME, "JahonXabarlari"],
              url: `${SITE_URL}/`,
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}${SITE_LOGO_SQUARE}`,
                width: 512,
                height: 512
              },
              image: `${SITE_URL}${SITE_OG_IMAGE}`,
              sameAs: SITE_SOCIAL_LINKS
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: SITE_NAME,
              alternateName: [SITE_ALTERNATE_NAME, "JahonXabarlari"],
              url: `${SITE_URL}/`,
              inLanguage: lang,
              publisher: { "@id": `${SITE_URL}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        <UiProvider initialLanguage={lang}>
          <SearchProvider>
            <NavProvider>
              {children}
              <SiteFooter />
              <ArticleModal />
              <BottomNav />
              <PushNotifications />
              <MobileCurrencyExperience />
              <SearchExperience />
              <SwipeNav />
            </NavProvider>
          </SearchProvider>
        </UiProvider>
      </body>
    </html>
  );
}
