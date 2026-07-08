"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Ordered top-level sections (matches the header nav). A horizontal swipe on
// mobile moves to the previous / next section.
const SECTIONS = [
  "/",
  "/category/ozbekiston",
  "/category/dunyo",
  "/category/siyosat",
  "/category/iqtisodiyot",
  "/category/texnologiya",
  "/category/sport",
  "/category/madaniyat"
];

// Walk up from the touch target: if any ancestor can actually scroll
// horizontally (chips row, carousels), let it scroll instead of navigating.
function inHorizontalScroller(node: EventTarget | null) {
  let el = node instanceof Element ? (node as HTMLElement) : null;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 4) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Mobile-only: swipe left/right anywhere on a section page to move between the
 * top-level sections. Ignores vertical scrolls, horizontal scrollers, and any
 * time an overlay (search / bottom sheet) is open.
 */
export default function SwipeNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const index = SECTIONS.indexOf(pathname);
    if (index === -1) return; // only on the section pages themselves

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (document.querySelector(".se-overlay, .bottom-sheet") || inHorizontalScroller(e.target)) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (window.matchMedia("(min-width: 1024px)").matches) return; // mobile/tablet only
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Clearly-horizontal swipe past the threshold only.
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const next = dx < 0 ? index + 1 : index - 1; // swipe left -> next
      if (next >= 0 && next < SECTIONS.length) router.push(SECTIONS[next]);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router]);

  return null;
}
