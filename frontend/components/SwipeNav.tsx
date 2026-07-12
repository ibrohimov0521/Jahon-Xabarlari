"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useNav } from "../lib/nav-context";
import { useSearch } from "../lib/search-context";

// Walk up from the touch target: if any ancestor can actually scroll
// horizontally (chips rows, carousels), let it scroll instead of switching tab.
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
 * Mobile-only: horizontal swipe moves between the FIVE bottom-bar tabs
 * (Home · News · Search · Popular · Menu) — NOT into their sub-sections.
 * Each tab triggers the same action the bar button would (route, sheet, or the
 * search overlay), so their own slide/fade animations play the transition.
 */
export default function SwipeNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { sheet, setSheet } = useNav();
  const { open: searchOpen, openSearch, closeSearch } = useSearch();

  useEffect(() => {
    const isNewsPath = pathname.startsWith("/category") || pathname.startsWith("/articles");
    const isSearchPath = pathname.startsWith("/search");
    const isMorePath = ["/editor-choice", "/about", "/ads", "/contact"].some((path) => pathname.startsWith(path));

    // Current tab (0..4) from the shared nav state.
    const currentTab = searchOpen || isSearchPath
      ? 2
      : sheet === "categories" || (!sheet && isNewsPath)
        ? 1
        : pathname.startsWith("/popular")
          ? 3
          : sheet === "more" || (!sheet && isMorePath)
            ? 4
            : 0;

    const goToTab = (i: number) => {
      switch (i) {
        case 0:
          closeSearch();
          setSheet(null);
          if (pathname !== "/") {
            document.documentElement.dataset.swipeDir = "prev";
            router.push("/");
          }
          break;
        case 1:
          closeSearch();
          setSheet("categories");
          break;
        case 2:
          setSheet(null);
          openSearch();
          break;
        case 3:
          closeSearch();
          setSheet(null);
          if (!pathname.startsWith("/popular")) {
            document.documentElement.dataset.swipeDir = "next";
            router.push("/popular");
          }
          break;
        case 4:
          closeSearch();
          setSheet("more");
          break;
      }
    };

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      // Ignore swipes inside horizontal scrollers or over a full modal.
      if (inHorizontalScroller(e.target) || document.querySelector('[class*="z-[200]"], [class*="z-[220]"]')) {
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
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8) return; // clearly horizontal only
      const next = Math.max(0, Math.min(4, currentTab + (dx < 0 ? 1 : -1))); // swipe left -> next tab
      if (next !== currentTab) goToTab(next);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router, sheet, setSheet, searchOpen, openSearch, closeSearch]);

  return null;
}
