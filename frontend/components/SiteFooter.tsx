import Link from "next/link";
import { SITE_FULL_NAME, SITE_TAGLINE } from "../lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-page site-footer-inner">
        <p>
          © {new Date().getFullYear()} {SITE_FULL_NAME}. {SITE_TAGLINE}
        </p>
        <nav aria-label="Sayt pastki havolalari">
          <Link href="/about">Sayt haqida</Link>
          <Link href="/ads">Reklama</Link>
          <Link href="/contact">Aloqa</Link>
        </nav>
      </div>
    </footer>
  );
}
