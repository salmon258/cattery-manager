'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Pill, History } from 'lucide-react';

import type { Medication, MedRoute, UserRole } from '@/lib/supabase/aliases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { CatDetailHeader } from '@/components/cats/detail/cat-detail-header';
import {
  DateRangeFilter,
  defaultLastNDays,
  endOfDayIso,
  startOfDayIso,
  type DateRange
} from '@/components/cats/detail/date-range-filter';

type HistoryEntry = {
  id: string;
  source: 'scheduled' | 'ad_hoc';
  given_at: string;
  medicine_name: string;
  dose: string | null;
  unit: string | null;
  route: MedRoute;
  notes: string | null;
  by: { id: string; full_name: string } | null;
};

async function fetchMedications(catId: string): Promise<Medication[]> {
  const r = await fetch(`/api/cats/${catId}/medications?include_inactive=1`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).medications;
}

async function fetchHistory(catId: string, range: DateRange): Promise<HistoryEntry[]> {
  const since = startOfDayIso(new Date(range.from));
  const until = endOfDayIso(new Date(range.to));
  const r = await fetch(
    `/api/cats/${catId}/medication-history?limit=500&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
    { cache: 'no-store' }
  );
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).entries;
}

interface Props {
  catId: string;
  catName: string;
  profilePhotoUrl: string | null;
  role: UserRole;
}

export function MedicationsDetail({ catId, catName, profilePhotoUrl }: Props) {
  const t = useTranslations('medications');
  const tc = useTranslations('common');
  const td = useTranslations('catDetail');

  const [range, setRange] = useState<DateRange>(defaultLastNDays(90));

  const { data: meds = [], isLoading: medsLoading } = useQuery({
    queryKey: ['medications-all', catId],
    queryFn: () => fetchMedications(catId)
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['medication-history-range', catId, range.from, range.to],
    queryFn: () => fetchHistory(catId, range)
  });

  const active = useMemo(() => meds.filter((m) => m.is_active), [meds]);
  const inactive = useMemo(() => meds.filter((m) => !m.is_active), [meds]);

  const totals = useMemo(() => {
    const scheduled = history.filter((h) => h.source === 'scheduled').length;
    const adHoc = history.filter((h) => h.source === 'ad_hoc').length;
    return { scheduled, adHoc, total: history.length };
  }, [history]);

  return (
    <div className="space-y-4">
      <CatDetailHeader
        catId={catId}
        catName={catName}
        profilePhotoUrl={profilePhotoUrl}
        subtitle={t('title')}
      />

      <Card className="border-l-4 border-l-violet-400">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-4 w-4 text-violet-500" />
            {t('activeSchedules')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {medsLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : active.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSchedules')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {active.map((m) => (
                <li key={m.id} className="py-2">
                  <div className="font-medium">
                    {m.medicine_name}
                    <span className="text-xs text-muted-foreground"> · {m.dose}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(m.start_date)} → {m.end_date ? formatDate(m.end_date) : t('ongoing')} ·{' '}
                    {t(`routes.${m.route}`)} · {t('intervalLabel', { n: m.interval_days })} ·{' '}
                    {m.time_slots.join(', ')}
                  </div>
                  {m.notes && (
                    <p className="mt-0.5 text-xs italic text-muted-foreground whitespace-pre-wrap">
                      {m.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {inactive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{td('pastSchedules')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {inactive.map((m) => (
                <li key={m.id} className="py-2">
                  <div className="font-medium text-muted-foreground">
                    {m.medicine_name}
                    <span className="text-xs"> · {m.dose}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(m.start_date)} →{' '}
                    {m.end_date ? formatDate(m.end_date) : t('ongoing')}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-violet-400" />
            {t('history.title')}
          </CardTitle>
          <DateRangeFilter
            value={range}
            onChange={setRange}
            presets={[
              { label: '7d', days: 7 },
              { label: '30d', days: 30 },
              { label: '90d', days: 90 }
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label={td('totalDoses')} value={totals.total.toLocaleString()} />
            <Stat label={td('scheduled')} value={totals.scheduled.toLocaleString()} />
            <Stat label={td('adHoc')} value={totals.adHoc.toLocaleString()} />
          </div>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {history.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      <span className="truncate">{e.medicine_name}</span>
                      <Badge
                        variant="secondary"
                        className={
                          e.source === 'scheduled'
                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }
                      >
                        {t(`history.source.${e.source}`)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDose(e)}
                      {e.dose || e.unit ? ' · ' : ''}
                      {t(`routes.${e.route}`)}
                      {e.by?.full_name ? ` · ${t('history.by', { name: e.by.full_name })}` : ''}
                    </div>
                    {e.notes && (
                      <p className="text-xs text-muted-foreground italic mt-0.5 whitespace-pre-wrap">
                        “{e.notes}”
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {new Date(e.given_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

function formatDose(e: HistoryEntry): string {
  if (e.dose && e.unit) return `${e.dose} ${e.unit}`;
  return e.dose ?? e.unit ?? '—';
}
