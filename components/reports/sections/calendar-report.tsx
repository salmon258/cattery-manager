'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';

type CalendarCategory =
  | 'birth'
  | 'vaccination'
  | 'deworming'
  | 'flea'
  | 'combined'
  | 'mating'
  | 'heat'
  | 'vet_visit';

type CalendarEvent = {
  id: string;
  date: string;
  category: CalendarCategory;
  kind: 'past' | 'scheduled';
  cat: { id: string; name: string } | null;
  title: string;
  detail?: string | null;
};

type CategoryMeta = {
  key: CalendarCategory;
  label: string;
  /** Tailwind classes for chip / dot. */
  dot: string;
  chipOn: string;
  chipOff: string;
};

const CATEGORIES: CategoryMeta[] = [
  { key: 'birth',       label: 'Birth',       dot: 'bg-pink-500',    chipOn: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/40 dark:text-pink-200 dark:border-pink-700',          chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'vaccination', label: 'Vaccination', dot: 'bg-blue-500',    chipOn: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',          chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'deworming',   label: 'Deworming',   dot: 'bg-emerald-500', chipOn: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700', chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'flea',        label: 'Flea',        dot: 'bg-amber-500',   chipOn: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',     chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'combined',    label: 'Combined',    dot: 'bg-teal-500',    chipOn: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-700',          chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'mating',      label: 'Mating',      dot: 'bg-purple-500',  chipOn: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700', chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'heat',        label: 'Heat',        dot: 'bg-rose-500',    chipOn: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700',          chipOff: 'bg-transparent text-muted-foreground border-border' },
  { key: 'vet_visit',   label: 'Vet visit',   dot: 'bg-sky-500',     chipOn: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700',                chipOff: 'bg-transparent text-muted-foreground border-border' }
];

const DOT_BY_CAT: Record<CalendarCategory, string> = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.dot;
  return acc;
}, {} as Record<CalendarCategory, string>);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

export function CalendarReport() {
  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(ymd(today));
  const [hidden, setHidden] = useState<Set<CalendarCategory>>(new Set());

  // Build a 6-row grid covering the visible month.
  const gridDays = useMemo(() => {
    const first = startOfMonth(cursor);
    const start = addDays(first, -first.getDay()); // Sunday before/at first
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const fromStr = ymd(gridDays[0]);
  const toStr   = ymd(gridDays[gridDays.length - 1]);

  const { data, isLoading } = useQuery<{ events: CalendarEvent[] }>({
    queryKey: ['report-calendar', fromStr, toStr],
    queryFn: async () => {
      const r = await fetch(`/api/reports/calendar?from=${fromStr}&to=${toStr}`, { cache: 'no-store' });
      if (!r.ok) return { events: [] };
      return r.json();
    }
  });
  const events = data?.events ?? [];

  // Group visible events by date.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (hidden.has(e.category)) continue;
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events, hidden]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function toggleCategory(key: CalendarCategory) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function showAll() { setHidden(new Set()); }
  function hideAll() { setHidden(new Set(CATEGORIES.map((c) => c.key))); }

  function gotoToday() {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    setCursor(startOfMonth(t));
    setSelectedDate(ymd(t));
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">Health calendar</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              History and scheduled events: birth, vaccination, deworming, flea, mating, heat, vet visits.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={gotoToday}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Categories:</span>
          {CATEGORIES.map((c) => {
            const on = !hidden.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCategory(c.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  on ? c.chipOn : c.chipOff
                )}
                aria-pressed={on}
              >
                <span className={cn('h-2 w-2 rounded-full', c.dot, !on && 'opacity-40')} />
                {c.label}
              </button>
            );
          })}
          <button type="button" onClick={showAll} className="text-xs text-muted-foreground underline-offset-2 hover:underline ml-1">
            Show all
          </button>
          <button type="button" onClick={hideAll} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            Hide all
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{monthLabel}</div>
          {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>

        {/* Calendar grid */}
        <div className="rounded-md border overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-1.5 text-center">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((d, i) => {
              const key       = ymd(d);
              const inMonth   = d.getMonth() === cursor.getMonth();
              const isToday   = key === ymd(today);
              const isSelected = key === selectedDate;
              const dayEvents = eventsByDate.get(key) ?? [];
              const visible   = dayEvents.slice(0, 3);
              const overflow  = dayEvents.length - visible.length;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    'min-h-[84px] border-t border-l p-1.5 text-left flex flex-col gap-1 transition-colors',
                    i % 7 === 6 && 'border-r',
                    i >= 35 && 'border-b',
                    !inMonth && 'bg-muted/20 text-muted-foreground',
                    isSelected && 'ring-2 ring-inset ring-primary',
                    'hover:bg-accent/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium',
                        isToday && 'bg-primary text-primary-foreground'
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate border',
                          CATEGORIES.find((c) => c.key === ev.category)?.chipOn,
                          ev.kind === 'scheduled' && 'border-dashed'
                        )}
                        title={`${ev.cat?.name ? ev.cat.name + ' · ' : ''}${ev.title}${ev.detail ? ' · ' + ev.detail : ''}`}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', DOT_BY_CAT[ev.category])} />
                        <span className="truncate">
                          {ev.cat?.name ? `${ev.cat.name} ` : ''}{ev.title}
                        </span>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{overflow} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {formatDate(selectedDate)} · {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events for this day.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {selectedEvents.map((ev) => {
                const meta = CATEGORIES.find((c) => c.key === ev.category)!;
                return (
                  <li key={ev.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', meta.dot)} />
                    <span className={cn('text-xs uppercase tracking-wider rounded px-1.5 py-0.5 border', meta.chipOn)}>
                      {meta.label}
                    </span>
                    <span className="font-medium">{ev.cat?.name ?? '—'}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{ev.title}</span>
                    {ev.detail && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{ev.detail}</span>
                      </>
                    )}
                    <span
                      className={cn(
                        'ml-auto text-[10px] uppercase tracking-wider rounded-full border px-1.5 py-0.5',
                        ev.kind === 'scheduled'
                          ? 'border-dashed text-muted-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {ev.kind === 'scheduled' ? 'Scheduled' : 'History'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
