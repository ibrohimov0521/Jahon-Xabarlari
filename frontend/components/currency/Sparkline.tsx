import type { Trend } from "../../lib/currency";

const COLOR: Record<Trend, string> = { up: "#16c784", down: "#ea3943", flat: "#94a3b8" };

// Mini TradingView-style sparkline: a soft area fill under a 2px line.
export function Sparkline({ data, trend, width = 72, height = 26 }: { data: number[]; trend: Trend; width?: number; height?: number }) {
  if (!data || data.length < 2) return <span className="cx-spark" style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 3;
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const pts = data.map((v, i) => [i * stepX, y(v)] as const);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const color = COLOR[trend];
  const id = `sg-${trend}-${Math.round(data[data.length - 1])}`;

  return (
    <svg className="cx-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
