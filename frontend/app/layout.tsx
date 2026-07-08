import type { Metadata } from "next";
import { ArticleModal } from "../components/ArticleModal";
import BottomNav from "../components/BottomNav";
import SearchExperience from "../components/SearchExperience";
import SwipeNav from "../components/SwipeNav";
import { SearchProvider } from "../lib/search-context";
import { UiProvider } from "../lib/ui-context";
import { SITE_ALTERNATE_NAME, SITE_DESCRIPTION, SITE_ICON_192, SITE_ICON_512, SITE_KEYWORDS, SITE_LOGO, SITE_NAME, SITE_OG_IMAGE, SITE_SOCIAL_LINKS, SITE_URL } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: SITE_ICON_192, sizes: "192x192", type: "image/png" },
      { url: SITE_ICON_512, sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon.png"]
  },
  alternates: {
    canonical: "/",
    languages: {
      uz: "/",
      ru: "/?lang=ru",
      en: "/?lang=en"
    }
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "uz_UZ",
    type: "website",
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: SITE_NAME
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    site: "@jahonxabarlari",
    creator: "@jahonxabarlari",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE]
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION
  },
  category: "news"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body>
        <div className="site-backdrop" aria-hidden="true" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsMediaOrganization",
              "@id": `${SITE_URL}/#organization`,
              name: SITE_NAME,
              alternateName: SITE_ALTERNATE_NAME,
              url: SITE_URL,
              logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}${SITE_ICON_512}`,
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
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: SITE_NAME,
              alternateName: SITE_ALTERNATE_NAME,
              url: SITE_URL,
              publisher: { "@id": `${SITE_URL}/#organization` },
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        <UiProvider>
          <SearchProvider>
            {children}
            <ArticleModal />
            <BottomNav />
            <SearchExperience />
            <SwipeNav />
          </SearchProvider>
        </UiProvider>
      </body>
    </html>
  );
}
