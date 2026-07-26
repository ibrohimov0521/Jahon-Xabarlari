"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LOGO, SITE_NAME } from "../lib/site";
import { SubscribeBox } from "./SubscribeBox";
import { useUi } from "../lib/ui-context";
import { localizedHref } from "../lib/localized-href";

const info = [
  { label: "about", href: "/about" },
  { label: "ads", href: "/ads" },
  { label: "contact", href: "/contact" },
  { label: "editorial", href: "/editorial-policy" },
  { label: "corrections", href: "/corrections" },
  { label: "privacy", href: "/privacy" }
] as const;

export function SiteFooter() {
  const pathname = usePathname();
  const { language, t } = useUi();

  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="site-footer">
      <div className="container-page site-footer-bar">
        <Link href={localizedHref("/", language)} className="site-footer-logo" aria-label={SITE_NAME}>
          <Image src={SITE_LOGO} alt={SITE_NAME} width={166} height={64} className="site-footer-logo-img" />
        </Link>

        <nav className="site-footer-nav" aria-label={t.footer.navigation}>
          {info.map((item) => (
            <Link key={item.href} href={localizedHref(item.href, language)}>
              {t.footer[item.label]}
            </Link>
          ))}
        </nav>

        <span className="site-footer-copy">© {new Date().getFullYear()} {SITE_NAME}</span>

        <SubscribeBox variant="inline" />
      </div>
    </footer>
  );
}
