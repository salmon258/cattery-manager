'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Check, X, Scale, Utensils, Pill, HeartPulse,
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown,
  User, AlertTriangle,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────
type FeedingMethod = 'self' | 'assisted' | 'force_fed';
type EatenRatio    = 'all' | 'most' | 'half' | 'little' | 'none';
type FoodType      = 'wet' | 'dry' | 'raw' | 'treat' | 'supplement' | 'other';

type MealItem = {
  name: string;
  food_type: FoodType;
  grams: number;
  eaten_g: number;
  kcal: number;
  ratio: EatenRatio;
};

type Meal = {
  id: string;
  meal_time: string;
  feeding_method: FeedingMethod;
  total_grams: number;
  total_eaten_g: number;
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

// Mirror the dropdown in log-eating-modal so category labels share the same
// hue across the app (wet=sky, dry=amber, raw=rose, …).
const FOOD_TYPE_STYLES: Record<FoodType, { label: string; dot: string }> = {
  wet:        { label: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-500' },
  dry:        { label: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500' },
  raw:        { label: 'text-rose-700 dark:text-rose-300',     dot: 'bg-rose-500' },
  treat:      { label: 'text-pink-700 dark:text-pink-300',     dot: 'bg-pink-500' },
  supplement: { label: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  other:      { label: 'text-slate-600 dark:text-slate-300',   dot: 'bg-slate-400' }
};

// Eaten/given ratio → green/orange/red text class for the xx/xx number.
// Buckets line up with the EATEN_RATIO_FACTOR breakpoints (0.75 / 0.5).
function eatenRatioColor(eaten: number, given: number): string {
  if (given <= 0) return 'text-muted-foreground';
  const r = eaten / given;
  if (r >= 0.75) return 'text-emerald-700 dark:text-emerald-300';
  if (r >= 0.5)  return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

// Flatten all of today's meal items into one row per food item. A single
// eating session with two foods produces two lines so the dashboard mirrors
// what was actually logged. Carries the parent meal's time + force-fed flag
// onto each row for context.
type ItemRow = {
  key: string;
  meal_time: string;
  forceFed: boolean;
  name: string;
  food_type: FoodType;
  grams: number;
  eaten_g: number;
};
function flattenItems(meals: Meal[]): ItemRow[] {
  const out: ItemRow[] = [];
  for (const m of meals) {
    const force = m.feeding_method === 'force_fed';
    const items = m.items && m.items.length > 0
      ? m.items
      : [{
          name: '',
          food_type: 'other' as FoodType,
          grams: m.total_grams,
          eaten_g: m.total_eaten_g,
          kcal: m.total_kcal,
          ratio: m.worst_ratio
        }];
    items.forEach((it, idx) => {
      out.push({
        key: `${m.id}-${idx}`,
        meal_time: m.meal_time,
        forceFed: force,
        name: it.name,
        food_type: it.food_type,
        grams: it.grams,
        eaten_g: it.eaten_g
      });
    });
  }
  return out;
}

// ─── Expand-all context ───────────────────────────────────────────────────
// Each MealDetails has its own local open/close state, but the parent can
// broadcast a "set everything to X" through this context. Bumping `version`
// signals each MealDetails to resync its local state to `expanded`.
const STORAGE_KEY = 'cattery.dashboard.foodDetailsExpanded';
type ExpandAllValue = { expanded: boolean; version: number };
const ExpandAllContext = createContext<ExpandAllValue>({ expanded: false, version: 0 });

// ─── Collapsible per-meal food breakdown ─────────────────────────────────
// Mirrors the "Today's activity" box on the sitter's "My cats" page so admins
// can see what each cat actually ate, not just the totals.
function MealDetails({ meals }: { meals: Meal[] }) {
  const t = useTranslations('adminDashboard.tracker');
  const { expanded, version } = useContext(ExpandAllContext);
  const [open, setOpen] = useState(expanded);
  // Re-sync local state whenever the parent toggles the global "expand all"
  // button. Individual toggles inside MealDetails still work between bumps.
  useEffect(() => {
    setOpen(expanded);
  }, [expanded, version]);

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
            const items: MealItem[] = m.items && m.items.length > 0
              ? m.items
              : [{
                  name: '',
                  food_type: 'other',
                  grams: m.total_grams,
                  eaten_g: m.total_eaten_g,
                  kcal: m.total_kcal,
                  ratio: m.worst_ratio
                }];
            const showTotals = items.length > 1;
            const totalCls = eatenRatioColor(m.total_eaten_g, m.total_grams);
            return (
              <li key={m.id} className="py-1 text-[11px] first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {formatTime(m.meal_time)} · {m.feeding_method}
                  </span>
                  {showTotals && (
                    <span className={cn('shrink-0 text-[10px] font-medium', totalCls)}>
                      {Math.round(m.total_eaten_g)}/{Math.round(m.total_grams)} g
                      <span className="ml-1 font-normal text-muted-foreground">
                        · {Math.round(m.total_kcal)} kcal
                      </span>
                    </span>
                  )}
                </div>
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((it, idx) => {
                    const style = FOOD_TYPE_STYLES[it.food_type] ?? FOOD_TYPE_STYLES.other;
                    const cls = eatenRatioColor(it.eaten_g, it.grams);
                    return (
                      <li key={idx} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 font-medium">
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
                          <span className={cn('truncate', style.label)}>
                            {it.name || t('mealFallback')}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px]">
                          <span className={cn('font-medium', cls)}>
                            {Math.round(it.eaten_g)}/{Math.round(it.grams)} g
                          </span>
                          <span className="text-muted-foreground">
                            · {Math.round(it.kcal)} kcal
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
  const totalEaten = cat.meals.reduce((s, m) => s + m.total_eaten_g, 0);
  const totalKcal  = cat.meals.reduce((s, m) => s + m.total_kcal, 0);
  const foodWarn = hasFoodWarning(cat);
  const weightDelta = computeWeightDelta(cat.latest_weight, cat.previous_weight);
  const itemRows = flattenItems(cat.meals);
  const totalsCls = eatenRatioColor(totalEaten, totalGrams);

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
              <span className={totalsCls}>
                {Math.round(totalEaten)}/{Math.round(totalGrams)} g
              </span>
              <span className="text-muted-foreground ml-1 font-normal">
                · {Math.round(totalKcal)} kcal · {cat.meals.length} meal{cat.meals.length > 1 ? 's' : ''}
              </span>
            </div>
            {itemRows.length > 0 && (
              <ul className="mt-0.5 space-y-0.5">
                {itemRows.map((row) => {
                  const style = FOOD_TYPE_STYLES[row.food_type] ?? FOOD_TYPE_STYLES.other;
                  const cls = eatenRatioColor(row.eaten_g, row.grams);
                  return (
                    <li
                      key={row.key}
                      className="flex items-center gap-1.5 text-[10px]"
                      title={`${row.food_type} — ${formatTime(row.meal_time)}`}
                    >
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatTime(row.meal_time)}
                      </span>
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
                      <span className={cn('min-w-0 flex-1 truncate font-medium', style.label)}>
                        {row.name || t('mealFallback')}
                      </span>
                      <span className={cn('shrink-0 font-medium', cls)}>
                        {Math.round(row.eaten_g)}/{Math.round(row.grams)} g
                      </span>
                      {row.forceFed && (
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
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

  // Persist the "expand all food details" preference across reloads. Read
  // synchronously on first render so we don't flash the wrong state, then
  // skip persisting on the very first effect run (the initial value already
  // came from storage).
  const [expandAll, setExpandAll] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [expandVersion, setExpandVersion] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, expandAll ? 'true' : 'false');
  }, [expandAll]);

  const expandValue = useMemo<ExpandAllValue>(
    () => ({ expanded: expandAll, version: expandVersion }),
    [expandAll, expandVersion]
  );
  const toggleExpandAll = () => {
    setExpandAll((v) => !v);
    setExpandVersion((v) => v + 1);
  };

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
    <ExpandAllContext.Provider value={expandValue}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="h-4 w-4 text-muted-foreground" />
                {t('title')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="shrink-0 h-7 gap-1 px-2 text-xs"
              aria-pressed={expandAll}
            >
              {expandAll ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
              {expandAll ? t('collapseAll') : t('expandAll')}
            </Button>
          </div>
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
    </ExpandAllContext.Provider>
  );
}
