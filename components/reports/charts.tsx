'use client';

/**
 * Lightweight hand-rolled SVG charts. No dependencies.
 * - <LineChart> for time series (single or multi-series).
 * - <BarChart>  for categorical counts.
 *
 * Both auto-scale to the data, render axis labels at the extremes only,
 * and inherit colour from `currentColor` so they pick up theme/text colour.
 */

interface SeriesPoint { x: string | number; y: number }

interface LineChartProps {
  data: { name: string; points: SeriesPoint[]; color?: string }[];
  width?: number;
  height?: number;
  yLabel?: string;
}

const PALETTE = [
  'rgb(59 130 246)',  // blue
  'rgb(16 185 129)',  // emerald
  'rgb(244 63 94)',   // rose
  'rgb(168 85 247)',  // purple
  'rgb(245 158 11)',  // amber
  'rgb(20 184 166)'   // teal
];

export function LineChart({ data, width = 600, height = 220, yLabel }: LineChartProps) {
  if (data.length === 0 || data.every((d) => d.points.length === 0)) {
    return <p className="text-xs text-muted-foreground py-4">No data in selected range.</p>;
  }

  const padX = 36;
  const padY = 20;
  const innerW = width  - padX * 2;
  const innerH = height - padY * 2;

  // Flatten all points to find global Y range
  const allY = data.flatMap((d) => d.points.map((p) => p.y));
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const rangeY = maxY - minY || 1;
  // 10% padding on top
  const yMin = minY - rangeY * 0.05;
  const yMax = maxY + rangeY * 0.10;
  const yRange = yMax - yMin || 1;

  // X is positional: each series uses its own index as X position normalised to 0..1
  function pathFor(points: SeriesPoint[]): string {
    if (points.length === 0) return '';
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;
    return points
      .map((p, i) => {
        const x = padX + i * step;
        const y = padY + innerH - ((p.y - yMin) / yRange) * innerH;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="text-foreground">
        {/* Y axis labels */}
        <text x={4} y={padY + 4} fontSize="10" className="fill-muted-foreground">{yMax.toFixed(1)}</text>
        <text x={4} y={padY + innerH} fontSize="10" className="fill-muted-foreground">{yMin.toFixed(1)}</text>
        {yLabel && (
          <text x={4} y={padY - 6} fontSize="10" className="fill-muted-foreground">{yLabel}</text>
        )}
        {/* X axis baseline */}
        <line x1={padX} x2={width - padX} y1={padY + innerH} y2={padY + innerH}
              stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />

        {data.map((series, i) => {
          const color = series.color ?? PALETTE[i % PALETTE.length];
          return (
            <g key={series.name}>
              <path d={pathFor(series.points)} fill="none" stroke={color} strokeWidth={1.5}
                    strokeLinecap="round" strokeLinejoin="round" />
              {series.points.map((p, idx) => {
                const step = series.points.length > 1 ? innerW / (series.points.length - 1) : 0;
                const x = padX + idx * step;
                const y = padY + innerH - ((p.y - yMin) / yRange) * innerH;
                return <circle key={idx} cx={x} cy={y} r={1.6} fill={color} />;
              })}
            </g>
          );
        })}
      </svg>
      {data.length > 1 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {data.map((series, i) => {
            const color = series.color ?? PALETTE[i % PALETTE.length];
            return (
              <div key={series.name} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color }} />
                <span className="text-muted-foreground">{series.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  width?: number;
  height?: number;
}

export function BarChart({ data, width = 600, height = 200 }: BarChartProps) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No data.</p>;
  }
  const padX = 24;
  const padY = 20;
  const innerW = width  - padX * 2;
  const innerH = height - padY * 2;
  const maxV   = Math.max(...data.map((d) => d.value), 1);
  const barW   = innerW / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%">
      <line x1={padX} x2={width - padX} y1={padY + innerH} y2={padY + innerH}
            stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
      {data.map((d, i) => {
        const h = (d.value / maxV) * innerH;
        const x = padX + i * barW + barW * 0.15;
        const y = padY + innerH - h;
        const w = barW * 0.7;
        const color = d.color ?? PALETTE[i % PALETTE.length];
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={w} height={h} fill={color} rx={2} />
            <text x={x + w / 2} y={y - 3} textAnchor="middle" fontSize="9" className="fill-muted-foreground">
              {d.value}
            </text>
            <text x={x + w / 2} y={padY + innerH + 12} textAnchor="middle" fontSize="9" className="fill-muted-foreground">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
