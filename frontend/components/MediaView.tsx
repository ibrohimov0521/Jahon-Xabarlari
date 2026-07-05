"use client";

import { useEffect, useState } from "react";

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
  // Reset before the new src's own onLoad recalculates it -- otherwise a reused instance (e.g.
  // ArticleModal swapping between articles) briefly keeps the previous image's styling.
  useEffect(() => {
    setIsSmallImage(false);
  }, [src]);
  if (!src) return null;
  if (isVideoUrl(src)) {
    return (
      <video className={videoClassName ?? className} controls muted playsInline preload="metadata">
        <source src={src} />
      </video>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      onLoad={(event) => {
        if (!avoidUpscale) return;
        const image = event.currentTarget;
        const tooNarrow = image.naturalWidth > 0 && image.clientWidth > 0 && image.naturalWidth < image.clientWidth * 0.85;
        const tooShort = image.naturalHeight > 0 && image.clientHeight > 0 && image.naturalHeight < image.clientHeight * 0.85;
        setIsSmallImage(tooNarrow || tooShort);
      }}
      style={isSmallImage ? { objectFit: "contain", backgroundColor: "rgba(2, 8, 23, 0.72)" } : undefined}
    />
  );
}
