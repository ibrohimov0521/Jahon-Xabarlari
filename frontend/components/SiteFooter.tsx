import Link from "next/link";
import { SITE_DESCRIPTION, SITE_FULL_NAME, SITE_SOCIAL_LINKS, SITE_TAGLINE } from "../lib/site";
import { SubscribeBox } from "./SubscribeBox";

const categories = [
  { label: "O'zbekiston", href: "/category/ozbekiston" },
  { label: "Dunyo", href: "/category/dunyo" },
  { label: "Siyosat", href: "/category/siyosat" },
  { label: "Iqtisodiyot", href: "/category/iqtisodiyot" },
  { label: "Texnologiya", href: "/category/texnologiya" },
  { label: "Sport", href: "/category/sport" },
  { label: "Madaniyat", href: "/category/madaniyat" }
];

const sections = [
  { label: "Ommabop", href: "/popular" },
  { label: "Muharrir tanlovi", href: "/editor-choice" },
  { label: "Qidiruv", href: "/search" }
];

const info = [
  { label: "Sayt haqida", href: "/about" },
  { label: "Reklama", href: "/ads" },
  { label: "Aloqa", href: "/contact" }
];

const socials = [
  { label: "Telegram", href: SITE_SOCIAL_LINKS[0] },
  { label: "Facebook", href: SITE_SOCIAL_LINKS[1] },
  { label: "Instagram", href: SITE_SOCIAL_LINKS[2] },
  { label: "YouTube", href: SITE_SOCIAL_LINKS[3] }
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-page site-footer-top">
        <div className="site-footer-brand">
          <p className="site-footer-name">{SITE_FULL_NAME}</p>
          <p className="site-footer-tagline">{SITE_TAGLINE}</p>
          <p className="site-footer-desc">{SITE_DESCRIPTION}</p>
          <div className="site-footer-social">
            {socials.map((item) => (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="site-footer-links">
          <div className="site-footer-col">
            <h3>Kategoriyalar</h3>
            <nav aria-label="Kategoriyalar">
              {categories.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="site-footer-col">
            <h3>Bo'limlar</h3>
            <nav aria-label="Bo'limlar">
              {sections.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="site-footer-col">
            <h3>Ma'lumot</h3>
            <nav aria-label="Ma'lumot">
              {info.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="site-footer-subscribe">
          <SubscribeBox />
        </div>
      </div>

      <div className="container-page site-footer-bottom">
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
