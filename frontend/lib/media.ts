// Shared, server-safe media helpers (no browser APIs, no "use client") so both the client
// MediaView component and server article page can use one implementation.
export function isVideoUrl(src?: string | null) {
  return !!src && /\.(mp4|webm|mov)(?:\?|#|$)/i.test(src);
}
