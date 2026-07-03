import type { Metadata } from "next";
import { UiProvider } from "../lib/ui-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jahon Xabarlari",
  description: "Tezkor, ishonchli va xolis yangiliklar portali",
  openGraph: {
    title: "Jahon Xabarlari",
    description: "O'zbekiston va dunyodagi eng muhim yangiliklar",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body><UiProvider>{children}</UiProvider></body>
    </html>
  );
}
