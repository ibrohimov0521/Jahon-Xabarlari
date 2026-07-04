type MediaViewProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  videoClassName?: string;
  priority?: boolean;
};

export function isVideoUrl(src?: string | null) {
  return !!src && /\.(mp4|webm|mov)(?:\?|#|$)/i.test(src);
}

export function MediaView({ src, alt = "", className = "", videoClassName, priority }: MediaViewProps) {
  if (!src) return null;
  if (isVideoUrl(src)) {
    return (
      <video className={videoClassName ?? className} controls muted playsInline preload="metadata">
        <source src={src} />
      </video>
    );
  }
  return <img src={src} alt={alt} className={className} loading={priority ? "eager" : "lazy"} />;
}
