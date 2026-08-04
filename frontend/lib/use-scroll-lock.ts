"use client";

import { useEffect } from "react";

type SavedStyles = {
  body: Partial<Record<"overflow" | "overscrollBehavior" | "position" | "top" | "left" | "right" | "width" | "paddingRight", string>>;
  html: Partial<Record<"overflow" | "overscrollBehavior" | "scrollBehavior", string>>;
  scrollY: number;
};

let lockCount = 0;
let saved: SavedStyles | null = null;

function lockPageScroll() {
  lockCount += 1;
  if (lockCount !== 1) return;

  const body = document.body.style;
  const html = document.documentElement.style;
  const scrollY = window.scrollY;
  const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

  saved = {
    body: {
      overflow: body.overflow,
      overscrollBehavior: body.overscrollBehavior,
      position: body.position,
      top: body.top,
      left: body.left,
      right: body.right,
      width: body.width,
      paddingRight: body.paddingRight
    },
    html: {
      overflow: html.overflow,
      overscrollBehavior: html.overscrollBehavior,
      scrollBehavior: html.scrollBehavior
    },
    scrollY
  };

  html.overflow = "hidden";
  html.overscrollBehavior = "none";
  body.overflow = "hidden";
  body.overscrollBehavior = "none";
  body.position = "fixed";
  body.top = `-${scrollY}px`;
  body.left = "0";
  body.right = "0";
  body.width = "100%";
  if (scrollbarGap > 0) body.paddingRight = `${scrollbarGap}px`;
}

function unlockPageScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0 || !saved) return;

  const body = document.body.style;
  const html = document.documentElement.style;
  const snapshot = saved;
  saved = null;

  body.overflow = snapshot.body.overflow ?? "";
  body.overscrollBehavior = snapshot.body.overscrollBehavior ?? "";
  body.position = snapshot.body.position ?? "";
  body.top = snapshot.body.top ?? "";
  body.left = snapshot.body.left ?? "";
  body.right = snapshot.body.right ?? "";
  body.width = snapshot.body.width ?? "";
  body.paddingRight = snapshot.body.paddingRight ?? "";
  html.overflow = snapshot.html.overflow ?? "";
  html.overscrollBehavior = snapshot.html.overscrollBehavior ?? "";
  html.scrollBehavior = "auto";
  window.scrollTo(0, snapshot.scrollY);
  html.scrollBehavior = snapshot.html.scrollBehavior ?? "";
}

/** Locks the document behind an open modal/sheet and safely supports nested overlays. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockPageScroll();
    return unlockPageScroll;
  }, [active]);
}
