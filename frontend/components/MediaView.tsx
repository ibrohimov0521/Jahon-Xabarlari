"use client";

import { CSSProperties, useEffect, useState } from "react";
import { isVideoUrl, toOptimizedImageSrc } from "../lib/media";

// Re-exported for existing importers of MediaView.
export { isVideoUrl };

type MediaViewProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  videoClassName?: string;
  priority?: boolean;
  avoidUpscale?: boolean;
  optimizedWidth?: number;
  sizes?: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
};

const NEXT_IMAGE_WIDTHS = [256, 384, 640, 750, 828, 1080, 1200, 1920] as const;

export function MediaView({
  src,
  alt = "",
  className = "",
  videoClassName,
  priority,
  avoidUpscale = true,
  optimizedWidth = 1200,
  sizes = "(max-width: 640px) calc(100vw - 20px), (max-width: 1279px) 50vw, 33vw",
  intrinsicWidth = 1200,
  intrinsicHeight = 675
}: MediaViewProps) {
  const [isSmallImage, setIsSmallImage] = useState(false);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [retried, setRetried] = useState(false);
  const [useDirectSrc, setUseDirectSrc] = useState(false);
  // Reset before the new src's own onLoad recalculates it -- otherwise a reused instance (e.g.
  // ArticleModal swapping between articles) briefly keeps the previous image's styling.
  useEffect(() => {
    setIsSmallImage(false);
    setNaturalWidth(0);
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
  const style: CSSProperties = {};
  if (isSmallImage) {
    style.objectFit = "contain";
    style.backgroundColor = "rgba(2, 8, 23, 0.72)";
    if (naturalWidth) {
      style.maxWidth = `${naturalWidth}px`;
      style.marginInline = "auto";
    }
  }
  const isRemoteImage = /^https?:\/\//i.test(src);
  const responsiveWidths = NEXT_IMAGE_WIDTHS.filter((width) => width <= optimizedWidth);
  if (!responsiveWidths.length) responsiveWidths.push(NEXT_IMAGE_WIDTHS[0]);
  const largestWidth = responsiveWidths.at(-1) ?? 1200;
  const optimizedSrc = toOptimizedImageSrc(src, largestWidth, 75);
  const finalSrc = useDirectSrc ? src : optimizedSrc;
  const srcSet = isRemoteImage && !useDirectSrc
    ? responsiveWidths.map((width) => `${toOptimizedImageSrc(src, width, 75)} ${width}w`).join(", ")
    : undefined;

  return (
    <img
      src={finalSrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={intrinsicWidth}
      height={intrinsicHeight}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onLoad={(event) => {
        if (!avoidUpscale) return;
        const image = event.currentTarget;
        const tooNarrow = image.naturalWidth > 0 && image.clientWidth > 0 && image.naturalWidth < image.clientWidth * 0.85;
        const tooShort = image.naturalHeight > 0 && image.clientHeight > 0 && image.naturalHeight < image.clientHeight * 0.85;
        const small = tooNarrow || tooShort;
        setIsSmallImage(small);
        setNaturalWidth(small ? image.naturalWidth : 0);
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
