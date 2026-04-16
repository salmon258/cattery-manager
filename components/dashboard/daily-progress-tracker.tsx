'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Check, X, Scale, Utensils, Pill, HeartPulse,
  ChevronDown, ChevronRight, User, AlertTriangle,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────
type FeedingMethod = 'self' | 'assisted' | 'force_fed';
type EatenRatio    = 'all' | 'most' | 'half' | 'little' | 'none';

type MealItem = {
  name: string;
  grams: number;
  kcal: number;
  ratio: EatenRatio;
};

type Meal = {
  id: string;
  meal_time: string;
  feeding_method: FeedingMethod;
  total_grams: number;
  total_kcal: number;
  worst_ratio: EatenRatio;
  food_names: string[];
  items: MealItem[];
};

type MedTask = {
  id: string;
  due_at: string;
  confirmed_at: string | null;
  skipped: boolean;
  overdue: boolean;
  medicine_name: string;
};

type WeightReading = { weight_kg: number; recorded_at: string };

type CatRow = {
  id: string;
  name: string;
  profile_photo_url: string | null;
  gender: 'male' | 'female';
  latest_weight: WeightReading | null;
  /** Most recent reading BEFORE today, if any (up to 30 days back). */
  previous_weight: WeightReading | null;
  meals: Meal[];
  med_tasks: MedTask[];
  open_tickets: number;
};

type DailyProgress = {
  date: string;
  sitters: { id: string; full_name: string; cats: CatRow[] }[];
  unassigned: CatRow[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function catCompletion(c: CatRow): number {
  const weight = c.latest_weight ? 1 : 0;
  const meals  = c.meals.length > 0 ? 1 : 0;
  const meds   = c.med_tasks.length === 0
    ? 1
    : c.med_tasks.filter((t) => t.confirmed_at || t.skipped).length / c.med_tasks.length;
  return (weight + meals + meds) / 3;
}

function hasFoodWarning(c: CatRow): boolean {
  return c.meals.some((m) => m.feeding_method === 'force_fed' || m.worst_ratio === 'none' || m.worst_ratio === 'little');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Compute a day-over-day weight delta chip: absolute difference in grams,
 * percentage change, and a direction used to pick the icon + colour. Returns
 * null when either side is missing so the caller can just skip rendering.
 */
type WeightDelta = {
  deltaKg: number;
  deltaG: number;
  pct: number;
  direction: 'up' | 'down' | 'flat';
};

function computeWeightDelta(
  latest: WeightReading | null,
  previous: WeightReading | null
): WeightDelta | null {
  if (!latest || !previous || previous.weight_kg <= 0) return null;
  const deltaKg = latest.weight_kg - previous.weight_kg;
  const pct = (deltaKg / previous.weight_kg) * 100;
  // Treat sub-gram noise as flat so tiny scale jitter doesn't draw attention.
  const direction: WeightDelta['direction'] =
    Math.abs(deltaKg) < 0.001 ? 'flat' : deltaKg > 0 ? 'up' : 'down';
  return { deltaKg, deltaG: deltaKg * 1000, pct, direction };
}

function WeightDeltaChip({ delta }: { delta: WeightDelta }) {
  const { deltaKg, deltaG, pct, direction } = delta;
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  const cls =
    direction === 'up'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : direction === 'down'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  // Show grams for sub-100g changes (more readable than "0.001 kg"), otherwise
  // display the delta in kg with 3-decimal precision to match the main reading.
  const absG = Math.abs(deltaG);
  const sign = deltaKg > 0 ? '+' : deltaKg < 0 ? '−' : '';
  const magnitude =
    absG < 100
      ? `${sign}${Math.round(absG)} g`
      : `${sign}${Math.abs(deltaKg).toFixed(3)} kg`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium',
        cls
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {magnitude}
      <span className="opacity-80">
        ({sign}
        {Math.abs(pct).toFixed(1)}%)
      </span>
    </span>
  );
}

function groupTasksByMedicine(tasks: MedTask[]): { name: string; tasks: MedTask[] }[] {
  const map = new Map<string, MedTask[]>();
  for (const t of tasks) {
    const key = t.medicine_name || '—';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  // Each group's tasks already arrive sorted by due_at from the API
  return Array.from(map.entries()).map(([name, tasks]) => ({ name, tasks }));
}

// Ratio → compact badge label + colour class
function ratioDisplay(r: EatenRatio): { label: string; cls: string } {
  switch (r) {
    case 'all':    return { label: '100%', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    case 'most':   return { label: '~75%', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    case 'half':   return { label: '~50%', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    case 'little': return { label: '~20%', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
    case 'none':   return { label: '0%',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  }
}

// ─── Collapsible per-meal food breakdown ─────────────────────────────────
// Mirrors the "Today's activity" box on the sitter's "My cats" page so admins
// can see what each cat actually ate, not just the totals.
function MealDetails({ meals }: { meals: Meal[] }) {
  const t = useTranslations('adminDashboard.tracker');
  const [open, setOpen] = useState(false);

  if (meals.length === 0) return null;

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={(e) => {
          // Cat row is a Link; don't navigate when toggling details.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className="text-muted-foreground">{t('foodDetails')}</span>
        <ChevronDown
          className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul className="divide-y divide-amber-100 bg-amber-50/50 px-2 py-1.5 dark:divide-amber-900/40 dark:bg-amber-950/20">
          {meals.map((m) => {
            // A single eating session can include multiple foods; render each
            // food as its own line so admins see per-food grams / kcal /
            // eaten ratio rather than just the meal totals.
            const items = m.items && m.items.length > 0
              ? m.items
              : [{ name: '', grams: m.total_grams, kcal: m.total_kcal, ratio: m.worst_ratio }];
            const showTotals = items.length > 1;
            return (
              <li key={m.id} className="py-1 text-[11px] first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {formatTime(m.meal_time)} · {m.feeding_method}
                  </span>
                  {showTotals && (
                    <span className="shrink-0 text-[10px]">
                      {Math.round(m.total_grams)} g · {Math.round(m.total_kcal)} kcal
                    </span>
                  )}
                </div>
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((it, idx) => {
                    const disp = ratioDisplay(it.ratio);
                    return (
                      <li key={idx} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">
                          {it.name || t('mealFallback')}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                          <span>{Math.round(it.grams)} g · {Math.round(it.kcal)} kcal</span>
                          <span className={cn('rounded px-1 py-0.5 font-medium', disp.cls)}>
                            {disp.label}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Cat row (rich) ───────────────────────────────────────────────────────
function CatRowItem({ cat }: { cat: CatRow }) {
  const t = useTranslations('adminDashboard.tracker');

  const medDone  = cat.med_tasks.filter((m) => m.confirmed_at || m.skipped).length;
  const medTotal = cat.med_tasks.length;
  const medOverdue = cat.med_tasks.some((m) => m.overdue);
  const totalGrams = cat.meals.reduce((s, m) => s + m.total_grams, 0);
  const totalKcal  = cat.meals.reduce((s, m) => s + m.total_kcal, 0);
  const foodWarn = hasFoodWarning(cat);
  const weightDelta = computeWeightDelta(cat.latest_weight, cat.previous_weight);

  return (
    <Link
      href={`/cats/${cat.id}`}
      className="flex flex-col gap-2 rounded-md border p-2.5 hover:bg-accent/50 transition-colors text-sm"
    >
      {/* Header row: avatar + name + ticket badge */}
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          {cat.profile_photo_url && <AvatarImage src={cat.profile_photo_url} alt={cat.name} />}
          <AvatarFallback className="text-xs">{cat.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <span className={cat.gender === 'female' ? 'text-pink-500' : 'text-blue-500'}>
            {cat.gender === 'female' ? '♀' : '♂'}
          </span>
          <span className="font-medium truncate">{cat.name}</span>
        </div>
        {cat.open_tickets > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
            <HeartPulse className="h-3 w-3" /> {cat.open_tickets}
          </span>
        )}
      </div>

      {/* Weight row */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded',
          cat.latest_weight
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
        )}>
          <Scale className="h-3 w-3" />
        </span>
        {cat.latest_weight ? (
          <>
            <span className="font-medium">
              {Number(cat.latest_weight.weight_kg).toFixed(3)} <span className="text-muted-foreground font-normal">kg</span>
              <span className="text-muted-foreground ml-1">@ {formatTime(cat.latest_weight.recorded_at)}</span>
            </span>
            {weightDelta && (
              <span
                className="inline-flex items-center gap-1"
                title={`${t('vsPrevious')} ${Number(cat.previous_weight!.weight_kg).toFixed(3)} kg · ${formatDay(cat.previous_weight!.recorded_at)}`}
              >
                <WeightDeltaChip delta={weightDelta} />
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">{t('weightMissing')}</span>
        )}
      </div>

      {/* Meals row */}
      <div className="flex items-start gap-2 text-xs">
        <span className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded shrink-0',
          cat.meals.length === 0
            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
            : foodWarn
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        )}>
          <Utensils className="h-3 w-3" />
        </span>
        {cat.meals.length === 0 ? (
          <span className="text-muted-foreground">{t('noMeals')}</span>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {Math.round(totalGrams)}g · {Math.round(totalKcal)} kcal
              <span className="text-muted-foreground ml-1">({cat.meals.length} meal{cat.meals.length > 1 ? 's' : ''})</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {cat.meals.map((m) => {
                const disp = ratioDisplay(m.worst_ratio);
                const isForce = m.feeding_method === 'force_fed';
                return (
                  <span
                    key={m.id}
                    className={cn('inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium', disp.cls)}
                    title={`${formatTime(m.meal_time)} — ${m.total_grams}g — ${m.feeding_method}`}
                  >
                    {formatTime(m.meal_time)} {disp.label}
                    {isForce && <AlertTriangle className="h-2.5 w-2.5" />}
                  </span>
                );
              })}
            </div>
            <MealDetails meals={cat.meals} />
          </div>
        )}
      </div>

      {/* Meds row — group by medicine name so the user sees what's prescribed */}
      {medTotal > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <span className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded shrink-0',
            medOverdue
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : medDone === medTotal
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          )}>
            <Pill className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {medDone}/{medTotal} {t('dosesConfirmedShort')}
            </div>
            <div className="space-y-0.5 mt-0.5">
              {groupTasksByMedicine(cat.med_tasks).map(({ name, tasks }) => (
                <div key={name} className="flex items-start gap-1 flex-wrap">
                  <span className="text-muted-foreground truncate max-w-[120px]" title={name}>
                    {name}
                  </span>
                  {tasks.map((task) => {
                    const done = !!task.confirmed_at;
                    const skip = task.skipped;
                    const cls = done
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : skip
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through'
                        : task.overdue
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
                    return (
                      <span
                        key={task.id}
                        className={cn('inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium', cls)}
                        title={`${name} — ${formatTime(task.due_at)}${done ? ' (done)' : skip ? ' (skipped)' : task.overdue ? ' (overdue)' : ' (pending)'}`}
                      >
                        {formatTime(task.due_at)}
                        {done
                          ? <Check className="h-2.5 w-2.5" />
                          : skip
                            ? <X className="h-2.5 w-2.5" />
                            : task.overdue
                              ? <AlertTriangle className="h-2.5 w-2.5" />
                              : null}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}

// ─── Sitter group ─────────────────────────────────────────────────────────
function SitterGroup({
  name, cats, defaultOpen
}: {
  name: string; cats: CatRow[]; defaultOpen?: boolean;
}) {
  const t = useTranslations('adminDashboard.tracker');
  const [open, setOpen] = useState(defaultOpen ?? true);

  if (cats.length === 0) return null;

  const avg = cats.reduce((s, c) => s + catCompletion(c), 0) / cats.length;
  const pct = Math.round(avg * 100);
  const allDone = pct === 100;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs text-muted-foreground">({cats.length})</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full transition-all', allDone ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-slate-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn('text-xs font-medium w-8 text-right', allDone && 'text-emerald-600')}>
            {pct}%
          </span>
        </div>
      </button>
      {open && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 pl-6">
          {cats.map((c) => <CatRowItem key={c.id} cat={c} />)}
        </div>
      )}
      {allDone && open && cats.length > 0 && (
        <p className="pl-6 text-[10px] text-emerald-600 italic">{t('allCaughtUp')}</p>
      )}
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────
export function DailyProgressTracker() {
  const t = useTranslations('adminDashboard.tracker');

  const { data, isLoading, error } = useQuery<DailyProgress>({
    queryKey: ['daily-progress'],
    queryFn: async () => {
      const r = await fetch('/api/dashboard/daily-progress', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    refetchInterval: 60_000
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Check className="h-4 w-4 text-muted-foreground" />
          {t('title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">Failed to load tracker.</p>}
        {data && (
          <>
            {data.sitters.length === 0 && data.unassigned.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('noCats')}</p>
            )}
            {data.sitters.map((s) => (
              <SitterGroup key={s.id} name={s.full_name} cats={s.cats} />
            ))}
            {data.unassigned.length > 0 && (
              <SitterGroup name={t('unassigned')} cats={data.unassigned} defaultOpen={false} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
