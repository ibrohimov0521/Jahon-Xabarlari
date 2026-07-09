"use client";

import { CSSProperties, useEffect, useState } from "react";
import { isVideoUrl } from "../lib/media";

// Re-exported for existing importers of MediaView.
export { isVideoUrl };

type MediaViewProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  videoClassName?: string;
  priority?: boolean;
  avoidUpscale?: boolean;
};

// Serve remote photos through this site's own Next image optimizer instead of hotlinking the
// third-party CDN directly. Visitors whose network can't reach the source CDN (regional blocks,
// hotlink protection) still get the image because their browser only ever talks to our origin,
// and the bytes arrive resized/optimized. Local, relative and data URLs are already same-origin.
// Deterministic (no browser APIs) so server and client render the same src -- no hydration drift.
function toImageSrc(src: string) {
  if (/^https?:\/\//i.test(src)) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=1200&q=75`;
  }
  return src;
}

export function MediaView({ src, alt = "", className = "", videoClassName, priority, avoidUpscale = true }: MediaViewProps) {
  const [isSmallImage, setIsSmallImage] = useState(false);
  const [retried, setRetried] = useState(false);
  const [useDirectSrc, setUseDirectSrc] = useState(false);
  // Reset before the new src's own onLoad recalculates it -- otherwise a reused instance (e.g.
  // ArticleModal swapping between articles) briefly keeps the previous image's styling.
  useEffect(() => {
    setIsSmallImage(false);
    setRetried(false);
    setUseDirectSrc(false);
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
  const optimizedSrc = toImageSrc(src);
  const isRemoteImage = /^https?:\/\//i.test(src);
  const finalSrc = useDirectSrc ? src : optimizedSrc;
  return (
    <img
      src={finalSrc}
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
        // If Next's optimizer cannot fetch a remote source, fall back to the original CDN URL.
        if (isRemoteImage && !useDirectSrc) {
          setUseDirectSrc(true);
          return;
        }
        // One-shot recovery from a transient/aborted load: force a fresh request for the same URL.
        if (retried) return;
        setRetried(true);
        const image = event.currentTarget;
        image.src = "";
        image.src = finalSrc;
      }}
      style={Object.keys(style).length ? style : undefined}
    />
  );
}
