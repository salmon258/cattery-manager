'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronDown,
  FlaskConical,
  Home,
  ListChecks,
  Pill,
  Scale,
  Search,
  Timer,
  Utensils,
  X
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Cat } from '@/lib/supabase/aliases';
import { LogWeightModal } from '@/components/weight/log-weight-modal';
import { LogEatingModal } from '@/components/eating/log-eating-modal';
import { LogAdHocMedModal } from '@/components/medications/log-ad-hoc-med-modal';
import { OpenTicketModal } from '@/components/health/open-ticket-modal';

type TodayWeight = { id: string; weight_kg: number; recorded_at: string };
type TodayMeal = {
  id: string;
  meal_time: string;
  feeding_method: 'self' | 'assisted' | 'force_fed';
  total_grams: number;
  total_kcal: number;
  food_names: string[];
};
type TodayAdHoc = {
  id: string;
  medicine_name: string;
  dose: string | null;
  unit: string | null;
  route: string | null;
  given_at: string;
};
type TodayConfirmedMed = {
  id: string;
  medicine_name: string;
  dose: string | null;
  due_at: string;
  confirmed_at: string;
};
type TodaySummary = {
  weights: TodayWeight[];
  meals: TodayMeal[];
  ad_hoc_meds: TodayAdHoc[];
  confirmed_med_tasks: TodayConfirmedMed[];
};

type MyCat = Cat & {
  current_room?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string } | null;
  last_weight_recorded_at?: string | null;
  open_ticket_count?: number;
  today_summary?: TodaySummary;
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

type MyTask = {
  id: string;
  due_at: string;
  cat: { id: string; name: string };
  medication: { id: string; medicine_name: string; dose: string };
};

async function fetchMyCats(): Promise<MyCat[]> {
  const r = await fetch('/api/me/cats', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).cats;
}

async function fetchMyTasks(): Promise<MyTask[]> {
  const r = await fetch('/api/me/tasks', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).tasks;
}

type SortKey = 'name_asc' | 'name_desc' | 'pending_desc' | 'tickets_desc' | 'room_asc';
type StatusFilter = 'all' | 'pending' | 'tickets' | 'clean';

export function MyCatsClient({ firstName }: { firstName: string }) {
  const ts = useTranslations('sitterHome');
  const tc = useTranslations('common');
  const tq = useTranslations('sitterActions');
  const tm = useTranslations('medications');
  const tf = useTranslations('sitterFilters');
  const qc = useQueryClient();

  const [weightTarget, setWeightTarget] = useState<{ id: string; name: string } | null>(null);
  const [mealTarget, setMealTarget] = useState<{ id: string; name: string } | null>(null);
  const [medTarget, setMedTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // Filter / sort state for the cat list.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');

  const { data: cats = [], isLoading, error, refetch } = useQuery({
    queryKey: ['me-cats'],
    queryFn: fetchMyCats
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['me-tasks'],
    queryFn: fetchMyTasks
  });

  const tasksByCat = useMemo(() => {
    const map = new Map<string, MyTask[]>();
    for (const t of tasks) {
      if (!map.has(t.cat.id)) map.set(t.cat.id, []);
      map.get(t.cat.id)!.push(t);
    }
    return map;
  }, [tasks]);

  // All distinct rooms represented in the current cat set, used to populate
  // the room filter dropdown.
  const availableRooms = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cats) {
      if (c.current_room?.id) seen.set(c.current_room.id, c.current_room.name);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cats]);

  // Computed list that respects search + status + room filters and the
  // selected sort order. Shared across rendering and the "no matches" state.
  const visibleCats = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = cats.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      if (roomFilter !== 'all' && c.current_room?.id !== roomFilter) return false;

      const catTasks = tasksByCat.get(c.id) ?? [];
      const needsWeightToday =
        !c.last_weight_recorded_at || !isToday(c.last_weight_recorded_at);
      const pendingCount = catTasks.length + (needsWeightToday ? 1 : 0);
      const openTickets = c.open_ticket_count ?? 0;

      if (statusFilter === 'pending' && pendingCount === 0) return false;
      if (statusFilter === 'tickets' && openTickets === 0) return false;
      if (statusFilter === 'clean' && (pendingCount > 0 || openTickets > 0)) return false;
      return true;
    });

    function pending(c: MyCat): number {
      const catTasks = tasksByCat.get(c.id) ?? [];
      const needsWeightToday =
        !c.last_weight_recorded_at || !isToday(c.last_weight_recorded_at);
      return catTasks.length + (needsWeightToday ? 1 : 0);
    }

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'pending_desc': {
          const diff = pending(b) - pending(a);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        case 'tickets_desc': {
          const diff = (b.open_ticket_count ?? 0) - (a.open_ticket_count ?? 0);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        case 'room_asc': {
          const ra = a.current_room?.name ?? '';
          const rb = b.current_room?.name ?? '';
          const diff = ra.localeCompare(rb);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [cats, tasksByCat, search, statusFilter, roomFilter, sortKey]);

  const hasActiveFilters =
    search.trim() !== '' || statusFilter !== 'all' || roomFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setRoomFilter('all');
  }

  const confirm = useMutation({
    mutationFn: async (taskId: string) => {
      const r = await fetch(`/api/tasks/${taskId}/confirm`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tm('taskConfirmed'));
      qc.invalidateQueries({ queryKey: ['me-tasks'] });
      qc.invalidateQueries({ queryKey: ['medication-tasks'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });


  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-5 text-white shadow-md">
        <h1 className="text-xl font-semibold drop-shadow-sm">{ts('title', { name: firstName })}</h1>
        <p className="text-sm text-white/90">{ts('subtitle')}</p>
      </header>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cats.length === 0 && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              {ts('assignedTitle')}
            </div>
            <p className="text-sm text-muted-foreground">{ts('emptyHint')}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cats.length > 0 && (
        <div className="sticky top-14 z-10 -mx-4 border-b bg-background/90 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tf('searchPlaceholder')}
                className="h-9 pl-9 pr-9"
                aria-label={tf('searchPlaceholder')}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label={tf('clearSearch')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-9 gap-2 sm:w-[180px]">
                <ArrowUpDown className="h-4 w-4 text-violet-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">{tf('sort.nameAsc')}</SelectItem>
                <SelectItem value="name_desc">{tf('sort.nameDesc')}</SelectItem>
                <SelectItem value="pending_desc">{tf('sort.pendingDesc')}</SelectItem>
                <SelectItem value="tickets_desc">{tf('sort.ticketsDesc')}</SelectItem>
                <SelectItem value="room_asc">{tf('sort.roomAsc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick filter chips + room filter */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FilterChip
              active={statusFilter === 'all'}
              color="slate"
              onClick={() => setStatusFilter('all')}
            >
              {tf('status.all')}
            </FilterChip>
            <FilterChip
              active={statusFilter === 'pending'}
              color="violet"
              onClick={() => setStatusFilter((s) => (s === 'pending' ? 'all' : 'pending'))}
            >
              <Timer className="h-3 w-3" /> {tf('status.pending')}
            </FilterChip>
            <FilterChip
              active={statusFilter === 'tickets'}
              color="rose"
              onClick={() => setStatusFilter((s) => (s === 'tickets' ? 'all' : 'tickets'))}
            >
              <AlertTriangle className="h-3 w-3" /> {tf('status.tickets')}
            </FilterChip>
            <FilterChip
              active={statusFilter === 'clean'}
              color="emerald"
              onClick={() => setStatusFilter((s) => (s === 'clean' ? 'all' : 'clean'))}
            >
              <Check className="h-3 w-3" /> {tf('status.clean')}
            </FilterChip>

            {availableRooms.length > 1 && (
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="ml-auto h-8 w-auto gap-2 text-xs">
                  <Home className="h-3.5 w-3.5 text-teal-500" />
                  <SelectValue placeholder={tf('room.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tf('room.all')}</SelectItem>
                  {availableRooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> {tf('clear')}
              </button>
            )}
          </div>

          <div className="mt-1.5 text-[11px] text-muted-foreground">
            {tf('resultsCount', { shown: visibleCats.length, total: cats.length })}
          </div>
        </div>
      )}

      {!isLoading && !error && cats.length > 0 && visibleCats.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {tf('noMatches')}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {visibleCats.map((c, idx) => {
          const catTasks = tasksByCat.get(c.id) ?? [];
          const needsWeightToday = !c.last_weight_recorded_at || !isToday(c.last_weight_recorded_at);
          const totalTodoCount = catTasks.length + (needsWeightToday ? 1 : 0);
          const openTickets = c.open_ticket_count ?? 0;
          const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length];
          return (
            <Card
              key={c.id}
              className={cn(
                'overflow-hidden border-l-4 shadow-sm transition-shadow hover:shadow-md',
                accent.border,
                accent.bg
              )}
            >
              <CardContent className="p-4 space-y-3">
                <Link href={`/cats/${c.id}`} className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {c.profile_photo_url ? <AvatarImage src={c.profile_photo_url} alt={c.name} /> : null}
                    <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-2">
                      {c.name}
                      {totalTodoCount > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <Timer className="h-3 w-3" /> {totalTodoCount}
                        </Badge>
                      )}
                      {openTickets > 0 && (
                        <Badge className="gap-1 bg-orange-100 text-orange-700 border-0 dark:bg-orange-900/30 dark:text-orange-300">
                          <AlertTriangle className="h-3 w-3" /> {openTickets}
                        </Badge>
                      )}
                    </div>
                    {c.current_room && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Home className="h-3 w-3" /> {c.current_room.name}
                      </div>
                    )}
                  </div>
                </Link>

                {(catTasks.length > 0 || needsWeightToday) && (
                  <ul className="space-y-1">
                    {needsWeightToday && (
                      <li className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            {tq('weightDue')}
                          </div>
                          <div className="text-xs text-muted-foreground">{tq('weightDueHint')}</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setWeightTarget({ id: c.id, name: c.name })}
                          className="bg-amber-500 text-white shadow hover:bg-amber-600"
                        >
                          <Scale className="h-3.5 w-3.5" /> {tq('logWeight')}
                        </Button>
                      </li>
                    )}
                    {catTasks.map((task) => {
                      const overdue = new Date(task.due_at) < new Date();
                      return (
                        <li
                          key={task.id}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-md border p-2 text-sm',
                            overdue && 'border-destructive/40 bg-destructive/5'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {task.medication.medicine_name}{' '}
                              <span className="text-xs text-muted-foreground">· {task.medication.dose}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {overdue && ` · ${tm('overdue')}`}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={confirm.isPending}
                            onClick={() => confirm.mutate(task.id)}
                            className="bg-emerald-500 text-white shadow hover:bg-emerald-600"
                          >
                            <Check className="h-3.5 w-3.5" /> {tm('confirm')}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <QuickAction
                    icon={Scale}
                    label={tq('logWeight')}
                    color="sky"
                    onClick={() => setWeightTarget({ id: c.id, name: c.name })}
                  />
                  <QuickAction
                    icon={Utensils}
                    label={tq('logMeal')}
                    color="amber"
                    onClick={() => setMealTarget({ id: c.id, name: c.name })}
                  />
                  <QuickAction
                    icon={FlaskConical}
                    label={tq('logMed')}
                    color="violet"
                    onClick={() => setMedTarget({ id: c.id, name: c.name })}
                  />
                  <QuickAction
                    icon={AlertTriangle}
                    label={tq('reportIssue')}
                    color="rose"
                    onClick={() => setReportTarget({ id: c.id, name: c.name })}
                  />
                </div>

                {c.today_summary && <TodayDetails summary={c.today_summary} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <LogWeightModal
        open={!!weightTarget}
        onClose={() => setWeightTarget(null)}
        catId={weightTarget?.id ?? ''}
        catName={weightTarget?.name}
      />
      <LogEatingModal
        open={!!mealTarget}
        onClose={() => setMealTarget(null)}
        catId={mealTarget?.id ?? ''}
        catName={mealTarget?.name}
      />
      <LogAdHocMedModal
        open={!!medTarget}
        onClose={() => setMedTarget(null)}
        catId={medTarget?.id ?? ''}
        catName={medTarget?.name}
      />
      <OpenTicketModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        catId={reportTarget?.id ?? ''}
        catName={reportTarget?.name}
      />
    </div>
  );
}

type QuickActionColor = 'sky' | 'amber' | 'violet' | 'rose';

const QUICK_ACTION_STYLES: Record<QuickActionColor, string> = {
  sky: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50',
  amber:
    'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50',
  violet:
    'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50'
};

const CARD_ACCENTS: Array<{ border: string; bg: string }> = [
  { border: 'border-l-sky-400', bg: 'bg-gradient-to-r from-sky-50/70 to-transparent dark:from-sky-950/30' },
  { border: 'border-l-emerald-400', bg: 'bg-gradient-to-r from-emerald-50/70 to-transparent dark:from-emerald-950/30' },
  { border: 'border-l-amber-400', bg: 'bg-gradient-to-r from-amber-50/70 to-transparent dark:from-amber-950/30' },
  { border: 'border-l-violet-400', bg: 'bg-gradient-to-r from-violet-50/70 to-transparent dark:from-violet-950/30' },
  { border: 'border-l-rose-400', bg: 'bg-gradient-to-r from-rose-50/70 to-transparent dark:from-rose-950/30' },
  { border: 'border-l-teal-400', bg: 'bg-gradient-to-r from-teal-50/70 to-transparent dark:from-teal-950/30' }
];

type FilterChipColor = 'slate' | 'violet' | 'rose' | 'emerald';

const FILTER_CHIP_STYLES: Record<FilterChipColor, { active: string; idle: string }> = {
  slate: {
    active: 'bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900',
    idle:   'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
  },
  violet: {
    active: 'bg-violet-500 text-white shadow',
    idle:   'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50'
  },
  rose: {
    active: 'bg-rose-500 text-white shadow',
    idle:   'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50'
  },
  emerald: {
    active: 'bg-emerald-500 text-white shadow',
    idle:   'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
  }
};

function FilterChip({
  active,
  color,
  onClick,
  children
}: {
  active: boolean;
  color: FilterChipColor;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const styles = FILTER_CHIP_STYLES[color];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? styles.active : styles.idle
      )}
    >
      {children}
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  color,
  onClick
}: {
  icon: typeof Scale;
  label: string;
  color: QuickActionColor;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        'h-auto flex-col gap-1 border py-2 shadow-sm transition-transform active:scale-95',
        QUICK_ACTION_STYLES[color]
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-medium">{label}</span>
    </Button>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TodayDetails({ summary }: { summary: TodaySummary }) {
  const ts = useTranslations('sitterHome');
  const [open, setOpen] = useState(false);
  const total =
    summary.weights.length +
    summary.meals.length +
    summary.ad_hoc_meds.length +
    summary.confirmed_med_tasks.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        {ts('todayEmpty')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-semibold text-white">
            {total}
          </span>
          <span>{ts('todayTitle')}</span>
          <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
            {summary.weights.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Scale className="h-3 w-3 text-sky-500" />
                {summary.weights.length}
              </span>
            )}
            {summary.meals.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Utensils className="h-3 w-3 text-amber-500" />
                {summary.meals.length}
              </span>
            )}
            {(summary.ad_hoc_meds.length > 0 || summary.confirmed_med_tasks.length > 0) && (
              <span className="flex items-center gap-0.5">
                <Pill className="h-3 w-3 text-violet-500" />
                {summary.ad_hoc_meds.length + summary.confirmed_med_tasks.length}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {summary.weights.length > 0 && (
            <div className="space-y-1 bg-sky-50/50 px-3 py-2 dark:bg-sky-950/20">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                <Scale className="h-3 w-3" /> {ts('todayWeights')}
              </div>
              <ul className="space-y-0.5">
                {summary.weights.map((w) => (
                  <li key={w.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{Number(w.weight_kg).toFixed(3)} kg</span>
                    <span className="text-muted-foreground">{formatTime(w.recorded_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.meals.length > 0 && (
            <div className="space-y-1 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <Utensils className="h-3 w-3" /> {ts('todayMeals')}
              </div>
              <ul className="space-y-1">
                {summary.meals.map((m) => (
                  <li key={m.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {m.food_names.length > 0 ? m.food_names.join(', ') : ts('todayMealFallback')}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{formatTime(m.meal_time)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.total_grams.toFixed(0)} g · {m.total_kcal.toFixed(0)} kcal · {m.feeding_method}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.confirmed_med_tasks.length > 0 && (
            <div className="space-y-1 bg-emerald-50/50 px-3 py-2 dark:bg-emerald-950/20">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <Check className="h-3 w-3" /> {ts('todayConfirmedMeds')}
              </div>
              <ul className="space-y-0.5">
                {summary.confirmed_med_tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-xs">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{t.medicine_name}</span>
                      {t.dose && <span className="text-muted-foreground"> · {t.dose}</span>}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{formatTime(t.confirmed_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.ad_hoc_meds.length > 0 && (
            <div className="space-y-1 bg-violet-50/50 px-3 py-2 dark:bg-violet-950/20">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                <Pill className="h-3 w-3" /> {ts('todayAdHocMeds')}
              </div>
              <ul className="space-y-0.5">
                {summary.ad_hoc_meds.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-xs">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{m.medicine_name}</span>
                      {m.dose && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {m.dose}
                          {m.unit ?? ''}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{formatTime(m.given_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
