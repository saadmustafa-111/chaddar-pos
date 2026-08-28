'use client';

import { useMemo } from 'react';

interface Props {
  /** Label for each slice, e.g. "Raw Coil", "Finished", "Plane". */
  labels: string[];
  values: number[];
  /** When true the chart masks numeric values. */
  hideValues: boolean;
  loading?: boolean;
}

/**
 * Compact inline-SVG donut + bar hybrid that shows the relative share
 * of three inventory buckets (raw / finished / plane). No external
 * dependency required.
 */
export function InventoryMixChart({
  labels,
  values,
  hideValues,
  loading,
}: Props) {
  const slices = useMemo(() => {
    const total = values.reduce((s, v) => s + Math.max(0, v), 0);
    if (total <= 0) return [];
    let cursor = 0;
    return values.map((v, i) => {
      const start = cursor / total;
      cursor += Math.max(0, v);
      const end = cursor / total;
      return { label: labels[i], value: v, start, end };
    });
  }, [labels, values]);

  if (loading) {
    return (
      <div className="h-40 rounded-lg bg-[#0D1117] border border-zinc-800 animate-pulse" />
    );
  }

  if (slices.length === 0) {
    return (
      <div className="h-40 rounded-lg bg-[#0D1117] border border-zinc-800 flex items-center justify-center text-xs text-zinc-500">
        No inventory yet.
      </div>
    );
  }

  const palette = ['#fde68a', '#a3e635', '#60a5fa', '#f472b6', '#f97316'];
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0">
        {slices.map((slice, i) => {
          const startAngle = slice.start * 360 - 90;
          const endAngle = slice.end * 360 - 90;
          const r = 38;
          const cx = 50;
          const cy = 50;
          const startRad = (Math.PI / 180) * startAngle;
          const endRad = (Math.PI / 180) * endAngle;
          const largeArc = endAngle - startAngle > 180 ? 1 : 0;
          const x1 = cx + r * Math.cos(startRad);
          const y1 = cy + r * Math.sin(startRad);
          const x2 = cx + r * Math.cos(endRad);
          const y2 = cy + r * Math.sin(endRad);
          return (
            <path
              key={`slice-${i}`}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={palette[i % palette.length]}
              stroke="#0B0F14"
              strokeWidth={1}
            />
          );
        })}
        <circle cx={50} cy={50} r={20} fill="#0B0F14" />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="#a1a1aa"
        >
          {hideValues ? '••••' : `${total.toFixed(0)} kg`}
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs flex-1 min-w-0">
        {slices.map((slice, i) => (
          <li key={`legend-${i}`} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: palette[i % palette.length] }}
            />
            <span className="text-zinc-300 truncate flex-1">
              {slice.label}
            </span>
            <span className="text-zinc-100 font-mono">
              {hideValues
                ? '••••'
                : `${slice.value.toFixed(2)} kg`}
            </span>
            <span className="text-zinc-500 w-10 text-right">
              {hideValues
                ? '••'
                : `${Math.round(slice.end * 100 - slice.start * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}