"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const ENTRY_KEY = "__bestTeamMobileEntry";
const GUARD_KEY = "__bestTeamMobileGuard";

/** Keeps the first mobile back action inside the site after a direct entry. */
export function MobileBackBoundary() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (pathnameRef.current.startsWith("/admin")) return;
    if (!window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches) return;

    const currentState = (window.history.state ?? {}) as Record<string, unknown>;
    if (!currentState[ENTRY_KEY] && !currentState[GUARD_KEY]) {
      window.history.replaceState({ ...currentState, [ENTRY_KEY]: true }, "", window.location.href);
      window.history.pushState({ ...currentState, [GUARD_KEY]: true }, "", window.location.href);
    }

    let boundaryUsed = false;
    const onPopState = (event: PopStateEvent) => {
      const state = (event.state ?? {}) as Record<string, unknown>;
      if (boundaryUsed || !state[ENTRY_KEY] || state[GUARD_KEY]) return;
      boundaryUsed = true;

      if (pathnameRef.current !== "/") {
        const language = new URLSearchParams(window.location.search).get("lang");
        router.replace(language ? `/?lang=${encodeURIComponent(language)}` : "/");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}
