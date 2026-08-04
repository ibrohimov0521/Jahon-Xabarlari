"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Advertisement } from "../lib/api";
import { API_URL } from "../lib/config";
import { isVideoUrl } from "../lib/media";
import { MediaView } from "./MediaView";

type Placement = Advertisement["placement"];

const placementClass: Record<Placement, string> = {
  HOME_BANNER: "ad-home-banner min-h-[112px] sm:min-h-[138px]",
  HOME_FEED: "ad-home-feed min-h-[160px] sm:min-h-[210px]",
  HOME_SIDEBAR: "ad-home-sidebar min-h-[300px]",
  ARTICLE_INLINE: "ad-article-inline min-h-[150px] sm:min-h-[190px]",
  ARTICLE_BOTTOM: "ad-article-bottom min-h-[130px] sm:min-h-[165px]"
};

function track(id: string, action: "impression" | "click") {
  void fetch(`${API_URL}/advertisements/${id}/${action}`, { method: "POST", keepalive: true }).catch(() => undefined);
}

function AdCreative({ ad, deviceClass }: { ad: Advertisement; deviceClass: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const key = `jh_ad_seen_${ad.id}`;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      observer.disconnect();
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // Storage can be unavailable in private contexts; the ad still renders normally.
      }
      track(ad.id, "impression");
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ad.id]);

  const content = (
    <>
      {ad.imageUrl && isVideoUrl(ad.imageUrl) ? (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" aria-label={ad.altText || ad.title}>
          <source src={ad.imageUrl} />
        </video>
      ) : ad.imageUrl ? (
        <MediaView
          src={ad.imageUrl}
          alt={ad.altText || ad.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          videoClassName="absolute inset-0 h-full w-full object-cover"
          sizes={ad.placement === "HOME_SIDEBAR" ? "330px" : "(max-width: 1024px) calc(100vw - 20px), 1180px"}
          optimizedWidth={ad.placement === "HOME_SIDEBAR" ? 768 : 1600}
        />
      ) : <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,.22),transparent_35%),linear-gradient(135deg,#071827,#0b2d3b)]" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/15" />
      <div className="relative flex h-full min-h-[inherit] flex-col justify-between p-4 text-white sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-md border border-white/25 bg-black/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide backdrop-blur-md">Reklama</span>
          {ad.targetUrl && <ExternalLink className="text-white/75" size={16} />}
        </div>
        <div className="max-w-xl">
          {ad.sponsorName && <p className="text-[11px] font-black uppercase text-cyan-200">{ad.sponsorName}</p>}
          <h3 className={`${ad.placement === "HOME_SIDEBAR" ? "text-xl" : "text-lg sm:text-2xl"} mt-1 line-clamp-2 font-black leading-tight`}>{ad.title}</h3>
        </div>
      </div>
    </>
  );

  return (
    <div ref={ref} className={`${deviceClass} ${placementClass[ad.placement]} group relative overflow-hidden rounded-lg border border-cyan-300/20 bg-[#071827] shadow-lg shadow-black/10`}>
      {ad.targetUrl ? (
        <a href={ad.targetUrl} target="_blank" rel="sponsored nofollow noopener noreferrer" onClick={() => track(ad.id, "click")} className="absolute inset-0 block" aria-label={`${ad.title} reklamasini ochish`}>
          {content}
        </a>
      ) : content}
    </div>
  );
}

export function AdPlacement({ desktop, mobile, className = "" }: { desktop?: Advertisement | null; mobile?: Advertisement | null; className?: string }) {
  const [currentDesktop, setCurrentDesktop] = useState(desktop ?? null);
  const [currentMobile, setCurrentMobile] = useState(mobile ?? null);
  const placement = desktop?.placement ?? mobile?.placement;

  useEffect(() => setCurrentDesktop(desktop ?? null), [desktop]);
  useEffect(() => setCurrentMobile(mobile ?? null), [mobile]);

  useEffect(() => {
    if (!placement) return;
    async function refresh(device: "mobile" | "desktop") {
      try {
        const query = new URLSearchParams({ placement: placement!, device });
        const response = await fetch(`${API_URL}/advertisements?${query}`, { cache: "no-store" });
        if (!response.ok) return;
        const next = ((await response.json()) as { item: Advertisement | null }).item;
        if (device === "mobile") setCurrentMobile(next);
        else setCurrentDesktop(next);
      } catch {
        // Keep the current creative when a background refresh fails.
      }
    }
    const timer = window.setInterval(() => {
      if (mobile) void refresh("mobile");
      if (desktop) void refresh("desktop");
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [desktop, mobile, placement]);

  if (!currentDesktop && !currentMobile) return null;
  return (
    <div className={className} role="complementary" aria-label="Reklama">
      {currentMobile && <AdCreative key={`mobile-${currentMobile.id}`} ad={currentMobile} deviceClass="md:hidden" />}
      {currentDesktop && <AdCreative key={`desktop-${currentDesktop.id}`} ad={currentDesktop} deviceClass="hidden md:block" />}
    </div>
  );
}
