import type { ReactNode } from "react";

// Compact circular SVG flags -- emoji flags don't render on Windows, so we ship our own.
// Simplified but recognisable at 14-22px. Add more as currencies are added.
const FLAGS: Record<string, ReactNode> = {
  US: (
    <>
      <rect width="24" height="24" fill="#b22234" />
      <g fill="#fff">
        {[2, 6, 10, 14, 18, 22].map((y) => (
          <rect key={y} y={y} width="24" height="2" />
        ))}
      </g>
      <rect width="11" height="13" fill="#3c3b6e" />
    </>
  ),
  EU: (
    <>
      <rect width="24" height="24" fill="#039" />
      <g fill="#fc0">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={12 + Math.cos(a) * 6.2} cy={12 + Math.sin(a) * 6.2} r="1.15" />;
        })}
      </g>
    </>
  ),
  RU: (
    <>
      <rect width="24" height="8" fill="#fff" />
      <rect y="8" width="24" height="8" fill="#0039a6" />
      <rect y="16" width="24" height="8" fill="#d52b1e" />
    </>
  ),
  CN: (
    <>
      <rect width="24" height="24" fill="#de2910" />
      <path d="M6 3l1.18 3.63H11l-3.09 2.24 1.18 3.63L6 10.26 2.9 12.5l1.18-3.63L1 6.63h3.82z" fill="#ffde00" />
      <g fill="#ffde00">
        <circle cx="12" cy="3" r="0.9" />
        <circle cx="14" cy="5.5" r="0.9" />
        <circle cx="14" cy="8.5" r="0.9" />
        <circle cx="12" cy="11" r="0.9" />
      </g>
    </>
  ),
  GB: (
    <>
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="4" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#c8102e" strokeWidth="2" />
      <path d="M12 0V24M0 12H24" stroke="#fff" strokeWidth="6" />
      <path d="M12 0V24M0 12H24" stroke="#c8102e" strokeWidth="3.4" />
    </>
  ),
  JP: (
    <>
      <rect width="24" height="24" fill="#fff" />
      <circle cx="12" cy="12" r="6" fill="#bc002d" />
    </>
  ),
  SA: (
    <>
      <rect width="24" height="24" fill="#006c35" />
      <rect x="5" y="15" width="14" height="1.6" rx="0.8" fill="#fff" />
      <rect x="5" y="8" width="10" height="1.4" rx="0.7" fill="#fff" />
    </>
  ),
  UZ: (
    <>
      <rect width="24" height="7.5" fill="#0099b5" />
      <rect y="7.5" width="24" height="1" fill="#ce1126" />
      <rect y="8.5" width="24" height="7" fill="#fff" />
      <rect y="15.5" width="24" height="1" fill="#ce1126" />
      <rect y="16.5" width="24" height="7.5" fill="#1eb53a" />
      <circle cx="5.2" cy="4" r="2.2" fill="#fff" />
      <circle cx="6.3" cy="4" r="2.2" fill="#0099b5" />
    </>
  ),
  KZ: (
    <>
      <rect width="24" height="24" fill="#00afca" />
      <circle cx="12" cy="11" r="4" fill="#fec50c" />
      <rect x="4" y="18" width="16" height="1.4" fill="#fec50c" />
    </>
  ),
  TR: (
    <>
      <rect width="24" height="24" fill="#e30a17" />
      <circle cx="10" cy="12" r="4.4" fill="#fff" />
      <circle cx="11.4" cy="12" r="3.5" fill="#e30a17" />
      <path d="M15 12l3.2-1-2 2.7v-3.4l2 2.7z" fill="#fff" />
    </>
  ),
  AE: (
    <>
      <rect width="7" height="24" fill="#ff0000" />
      <rect x="7" width="17" height="8" fill="#00732f" />
      <rect x="7" y="8" width="17" height="8" fill="#fff" />
      <rect x="7" y="16" width="17" height="8" fill="#000" />
    </>
  ),
  KR: (
    <>
      <rect width="24" height="24" fill="#fff" />
      <path d="M12 8a4 4 0 010 8 4 4 0 000-8z" fill="#cd2e3a" />
      <path d="M12 8a4 4 0 000 8 4 4 0 010-8z" fill="#0047a0" />
    </>
  ),
  IN: (
    <>
      <rect width="24" height="8" fill="#ff9933" />
      <rect y="8" width="24" height="8" fill="#fff" />
      <rect y="16" width="24" height="8" fill="#138808" />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="#000080" strokeWidth="0.8" />
    </>
  ),
  CH: (
    <>
      <rect width="24" height="24" fill="#d52b1e" />
      <rect x="10.5" y="6" width="3" height="12" fill="#fff" />
      <rect x="6" y="10.5" width="12" height="3" fill="#fff" />
    </>
  )
};

export function Flag({ country, size = 16 }: { country: string; size?: number }) {
  const svg = FLAGS[country];
  return (
    <span className="cx-flag" style={{ width: size, height: size }} aria-hidden="true">
      {svg ? (
        <svg viewBox="0 0 24 24" width={size} height={size}>
          {svg}
        </svg>
      ) : (
        <span className="cx-flag-fallback">{country.slice(0, 2)}</span>
      )}
    </span>
  );
}
