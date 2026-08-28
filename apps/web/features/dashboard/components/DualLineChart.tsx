'use client';

import { useMemo } from 'react';

interface Point {
  label: string;
  primary: number;
  secondary: number;
}

interface Props {
  points: Point[];
  primaryLabel: string;
  secondaryLabel: string;
  /** When true the chart never reveals numeric axes / values - used
   * to honor the eye-toggle privacy preference. */
  hideValues: boolean;
  loading?: boolean;
}

/**
 * Tiny dependency-free dual-series line chart rendered as inline SVG.
 * Both series share a single 0..max Y axis so the relative magnitudes
 * are easy to compare. The chart is fully responsive: it scales to
 * its parent width and respects a fixed aspect ratio.
 */
export function DualLineChart({
  points,
  primaryLabel,
  secondaryLabel,
  hideValues,
  loading,
}: Props) {
  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const width = 720;
    const height = 240;
    const padding = { top: 16, right: 12, bottom: 28, left: 48 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const max = Math.max(
      1,
      ...points.map((p) => Math.max(p.primary, p.secondary)),
    );
    const xStep = points.length === 1 ? 0 : innerW / (points.length - 1);
    const y = (n: number) => padding.top + innerH - (n / max) * innerH;
    const x = (i: number) =>
      padding.left + (points.length === 1 ? innerW / 2 : i * xStep);
    const path = (key: 'primary' | 'secondary') =>
      points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p[key])}`)
        .join(' ');
    return {
      width,
      height,
      padding,
      innerH,
      innerW,
      max,
      pathPrimary: path('primary'),
      pathSecondary: path('secondary'),
      y,
      x,
      tickCount: 4,
    };
  }, [points]);

  if (loading || !layout) {
    return (
      <div className="h-60 rounded-lg bg-[#0D1117] border border-zinc-800 animate-pulse" />
    );
  }

  const ticks = Array.from({ length: layout.tickCount + 1 }, (_, i) =>
    Math.round((layout.max * i) / layout.tickCount),
  );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="none"
        className="w-full h-60"
        role="img"
        aria-label={`${primaryLabel} vs ${secondaryLabel} chart`}
      >
        {/* Y axis grid */}
        {ticks.map((tick, i) => {
          const y = layout.y(tick);
          return (
            <g key={`tick-${i}`}>
              <line
                x1={layout.padding.left}
                x2={layout.padding.left + layout.innerW}
                y1={y}
                y2={y}
                stroke="#27272a"
                strokeWidth={1}
              />
              <text
                x={layout.padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#71717a"
              >
                {hideValues
                  ? '•••'
                  : tick >= 100000
                    ? `${Math.round(tick / 1000)}k`
                    : tick.toString()}
              </text>
            </g>
          );
        })}
        {/* X axis labels */}
        {points.map((p, i) => (
          <text
            key={`x-${i}`}
            x={layout.x(i)}
            y={layout.height - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#71717a"
          >
            {p.label}
          </text>
        ))}
        {/* Lines */}
        <path
          d={layout.pathSecondary}
          fill="none"
          stroke="#a3e635"
          strokeOpacity={0.75}
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <path
          d={layout.pathPrimary}
          fill="none"
          stroke="#fde68a"
          strokeWidth={2.25}
        />
        {/* Tooltips via SVG title tags */}
        {points.map((p, i) => (
          <g key={`pt-${i}`}>
            <circle
              cx={layout.x(i)}
              cy={layout.y(p.primary)}
              r={2.5}
              fill="#fde68a"
            >
              <title>
                {primaryLabel}:{' '}
                {hideValues
                  ? '••••••'
                  : new Intl.NumberFormat('en-US').format(p.primary)}
              </title>
            </circle>
            <circle
              cx={layout.x(i)}
              cy={layout.y(p.secondary)}
              r={2.5}
              fill="#a3e635"
            >
              <title>
                {secondaryLabel}:{' '}
                {hideValues
                  ? '••••••'
                  : new Intl.NumberFormat('en-US').format(p.secondary)}
              </title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-yellow-300" /> {primaryLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-0.5"
            style={{
              backgroundImage:
                'linear-gradient(to right, #a3e635 50%, transparent 50%)',
              backgroundSize: '6px 1px',
              backgroundRepeat: 'repeat-x',
            }}
          />{' '}
          {secondaryLabel}
        </span>
      </div>
    </div>
  );
}