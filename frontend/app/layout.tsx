import type { Metadata } from "next";
import { UiProvider } from "../lib/ui-context";
import { SITE_DESCRIPTION, SITE_ICON_192, SITE_ICON_512, SITE_LOGO, SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsMediaOrganization",
              name: SITE_NAME,
              url: SITE_URL,
              logo: `${SITE_URL}${SITE_LOGO}`,
              image: `${SITE_URL}${SITE_OG_IMAGE}`,
              sameAs: ["https://t.me/", "https://facebook.com/", "https://instagram.com/", "https://youtube.com/"]
            })
          }}
        />
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
