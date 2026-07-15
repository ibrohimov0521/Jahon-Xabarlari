"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LOGO, SITE_NAME } from "../lib/site";
import { SubscribeBox } from "./SubscribeBox";

const info = [
  { label: "Sayt haqida", href: "/about" },
  { label: "Reklama", href: "/ads" },
  { label: "Aloqa", href: "/contact" },
  { label: "Tahririyat siyosati", href: "/editorial-policy" },
  { label: "Tuzatishlar", href: "/corrections" },
  { label: "Maxfiylik", href: "/privacy" }
];

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="site-footer">
      <div className="container-page site-footer-bar">
        <Link href="/" className="site-footer-logo" aria-label={SITE_NAME}>
          <Image src={SITE_LOGO} alt={SITE_NAME} width={166} height={64} className="site-footer-logo-img" />
        </Link>

        <nav className="site-footer-nav" aria-label="Sayt havolalari">
          {info.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <span className="site-footer-copy">© {new Date().getFullYear()} {SITE_NAME}</span>

        <SubscribeBox variant="inline" />
      </div>
    </footer>
  );
}
