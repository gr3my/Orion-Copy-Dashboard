"use client";

import type { MetricSeries } from "../lib/types";

function bounds(points: { value: number }[]) {
  const vals = points.map((p) => p.value);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  return { max, min: Math.min(min, 0) };
}

export function Sparkline({ series, width = 260, height = 64 }: { series: MetricSeries; width?: number; height?: number }) {
  const pts = series.points;
  if (!pts.length) return <div className="text-sm" style={{ color: "var(--muted)" }}>No data</div>;
  const { max } = bounds(pts);
  const step = pts.length > 1 ? width / (pts.length - 1) : width;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 6 - (p.value / max) * (height - 12)).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[13px]" style={{ color: "var(--muted)" }}>{series.label}</span>
        <span className="text-lg font-medium tabular">{last.value}</span>
      </div>
      <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.label}>
        <path d={d} fill="none" stroke="#7cc7ff" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function BarRow({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[13px] mb-1">
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span className="tabular">{used} / {total}</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--surface2)" }}>
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? "var(--red)" : pct > 70 ? "var(--yellow)" : "var(--green)" }} />
      </div>
    </div>
  );
}
