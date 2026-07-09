"use client";

import { CSSProperties, useEffect, useState } from "react";

type MediaViewProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  videoClassName?: string;
  priority?: boolean;
  avoidUpscale?: boolean;
};

export function isVideoUrl(src?: string | null) {
  return !!src && /\.(mp4|webm|mov)(?:\?|#|$)/i.test(src);
}

export function MediaView({ src, alt = "", className = "", videoClassName, priority, avoidUpscale = true }: MediaViewProps) {
  const [isSmallImage, setIsSmallImage] = useState(false);
  const [retried, setRetried] = useState(false);
  // Reset before the new src's own onLoad recalculates it -- otherwise a reused instance (e.g.
  // ArticleModal swapping between articles) briefly keeps the previous image's styling.
  useEffect(() => {
    setIsSmallImage(false);
    setRetried(false);
  }, [src]);
  if (!src) return null;
  if (isVideoUrl(src)) {
    return (
      <video className={videoClassName ?? className} controls muted playsInline preload="metadata">
        <source src={src} />
      </video>
    );
  }
  // A key photo (priority) must never collapse to a 0-height gap that reveals the page backdrop
  // while it downloads on a slow connection (no intrinsic height until the bytes arrive) -- reserve
  // a dark placeholder box so the frame stays put, then the loaded image fills it. Landscape news
  // photos are taller than this, so there is no visible letterboxing in practice. Applied
  // unconditionally (not gated on an onLoad flag, which never fires for already-cached images).
  const style: CSSProperties = {};
  if (isSmallImage) {
    style.objectFit = "contain";
    style.backgroundColor = "rgba(2, 8, 23, 0.72)";
  }
  if (priority) {
    style.minHeight = "240px";
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onLoad={(event) => {
        if (!avoidUpscale) return;
        const image = event.currentTarget;
        const tooNarrow = image.naturalWidth > 0 && image.clientWidth > 0 && image.naturalWidth < image.clientWidth * 0.85;
        const tooShort = image.naturalHeight > 0 && image.clientHeight > 0 && image.naturalHeight < image.clientHeight * 0.85;
        setIsSmallImage(tooNarrow || tooShort);
      }}
      onError={(event) => {
        // One-shot recovery from a transient/aborted load: force a fresh request for the same URL.
        if (retried) return;
        setRetried(true);
        const image = event.currentTarget;
        const url = src;
        image.src = "";
        image.src = url;
      }}
      style={Object.keys(style).length ? style : undefined}
    />
  );
}
