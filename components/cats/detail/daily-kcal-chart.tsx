'use client';

import { cn } from '@/lib/utils';

interface Day {
  date: string;
  kcal: number;
}

interface Props {
  days: Day[];
  target: number | null;
  height?: number;
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

export function DailyKcalChart({ days, target, height = 280 }: Props) {
  if (days.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-6 text-center">No data in selected range.</p>
    );
  }

  const peak = Math.max(...days.map((d) => d.kcal), 0);
  const max = Math.max(target ?? 0, peak, 1);
  const yMax = niceCeil(max);
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((yMax / tickCount) * (tickCount - i))
  );

  // Keep labels readable: show every Nth tick only if too many days.
  const showLabelEvery = Math.max(1, Math.ceil(days.length / 14));

  return (
    <div className="flex gap-2">
      <div
        className="flex flex-col justify-between text-[10px] text-muted-foreground shrink-0 text-right"
        style={{ height, width: 36 }}
        aria-hidden
      >
        {ticks.map((v) => (
          <span key={v} className="leading-none">
            {v}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="relative flex items-end gap-0.5 border-l border-b border-muted-foreground/20"
          style={{ height }}
        >
          {/* Grid lines */}
          {ticks.slice(1, -1).map((v) => (
            <div
              key={v}
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 border-t border-muted-foreground/10"
              style={{ bottom: `${(v / yMax) * 100}%` }}
            />
          ))}
          {target != null && target <= yMax && (
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-emerald-400/80"
              style={{ bottom: `${(target / yMax) * 100}%` }}
              title={`Target: ${target} kcal`}
            />
          )}
          {days.map((d) => {
            const h = (d.kcal / yMax) * 100;
            const color = target
              ? d.kcal / target >= 0.8
                ? 'bg-emerald-500'
                : d.kcal / target >= 0.5
                  ? 'bg-amber-500'
                  : d.kcal > 0
                    ? 'bg-destructive/60'
                    : 'bg-muted'
              : d.kcal > 0
                ? 'bg-amber-500'
                : 'bg-muted';
            return (
              <div
                key={d.date}
                className="relative flex-1 h-full flex flex-col justify-end items-center min-w-[4px]"
                title={`${d.date}: ${d.kcal} kcal`}
              >
                <div
                  className={cn('w-full rounded-t-sm transition-all', color)}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-0.5">
          {days.map((d, i) => (
            <span
              key={d.date}
              className="flex-1 text-center text-[9px] text-muted-foreground truncate min-w-0"
            >
              {i % showLabelEvery === 0 ? d.date.slice(5) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
