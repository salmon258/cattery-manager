'use client';

/**
 * Hand-rolled SVG sparkline — avoids pulling in a full chart lib.
 * Expects ascending-by-time data; renders a simple line + dots + current value.
 */
export function WeightSparkline({
  points,
  width = 260,
  height = 56
}: {
  points: { weight_kg: number; recorded_at: string }[];
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 4;
  const innerH = height - padY * 2;

  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const xs = points.map((_, i) => i * step);
  const ys = values.map((v) => padY + innerH - ((v - min) / range) * innerH);

  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Weight trend"
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
      {xs.map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={ys[i]}
          r={i === xs.length - 1 ? 3 : 1.5}
          className="fill-primary"
        />
      ))}
    </svg>
  );
}
