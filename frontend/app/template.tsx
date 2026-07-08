"use client";

import { useEffect, useRef } from "react";

/**
 * Route-level transition. `template.tsx` remounts on every navigation, so this
 * plays a quick enter animation each time. SwipeNav sets
 * `document.documentElement.dataset.swipeDir` to "next" / "prev" so the page
 * slides in from the matching side; other navigations get a soft fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dir = document.documentElement.dataset.swipeDir;
    delete document.documentElement.dataset.swipeDir;
    const cls = dir === "next" ? "pt-next" : dir === "prev" ? "pt-prev" : "pt-fade";
    el.classList.add(cls);
    const done = () => el.classList.remove(cls);
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
  }, []);

  return (
    <div ref={ref} className="page-transition">
      {children}
    </div>
  );
}
