'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Scale } from 'lucide-react';

import type { UserRole, WeightLog } from '@/lib/supabase/aliases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart } from '@/components/reports/charts';
import { formatDate } from '@/lib/utils';
import { CatDetailHeader } from '@/components/cats/detail/cat-detail-header';
import {
  DateRangeFilter,
  defaultLastNDays,
  endOfDayIso,
  startOfDayIso,
  type DateRange
} from '@/components/cats/detail/date-range-filter';

type WeightLogRow = WeightLog & { submitter?: { id: string; full_name: string } | null };

async function fetchLogs(catId: string, range: DateRange): Promise<WeightLogRow[]> {
  const since = startOfDayIso(new Date(range.from));
  const until = endOfDayIso(new Date(range.to));
  const r = await fetch(
    `/api/cats/${catId}/weight?limit=500&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
    { cache: 'no-store' }
  );
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).logs;
}

interface Props {
  catId: string;
  catName: string;
  profilePhotoUrl: string | null;
  role: UserRole;
  currentUserId: string;
}

export function WeightDetail({ catId, catName, profilePhotoUrl }: Props) {
  const t = useTranslations('weight');
  const tc = useTranslations('common');
  const td = useTranslations('catDetail');
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  const [range, setRange] = useState<DateRange>(defaultLastNDays(90));

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['weight-range', catId, range.from, range.to],
    queryFn: () => fetchLogs(catId, range)
  });

  const ascending = useMemo(() => [...logs].reverse(), [logs]);
  const toGrams = (kg: number) => Math.round(Number(kg) * 1000);

  const stats = useMemo(() => {
    if (logs.length === 0) {
      return { latest: null as number | null, min: null, max: null, avg: null, delta: null };
    }
    const g = logs.map((l) => toGrams(Number(l.weight_kg)));
    const latest = g[0];
    const earliest = g[g.length - 1];
    return {
      latest,
      min: Math.min(...g),
      max: Math.max(...g),
      avg: Math.round(g.reduce((a, b) => a + b, 0) / g.length),
      delta: latest - earliest
    };
  }, [logs]);

  return (
    <div className="space-y-4">
      <CatDetailHeader
        catId={catId}
        catName={catName}
        profilePhotoUrl={profilePhotoUrl}
        subtitle={t('title')}
      />

      <Card className="border-l-4 border-l-sky-400">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-sky-500" />
            {td('weightOverRange')}
          </CardTitle>
          <DateRangeFilter
            value={range}
            onChange={setRange}
            presets={[
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
              { label: '365d', days: 365 }
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat
              label={t('lastRecorded')}
              value={stats.latest != null ? `${fmt.format(stats.latest)} g` : '—'}
            />
            <Stat
              label={td('min')}
              value={stats.min != null ? `${fmt.format(stats.min)} g` : '—'}
            />
            <Stat
              label={td('max')}
              value={stats.max != null ? `${fmt.format(stats.max)} g` : '—'}
            />
            <Stat
              label={td('change')}
              value={
                stats.delta != null
                  ? `${stats.delta > 0 ? '+' : stats.delta < 0 ? '−' : ''}${fmt.format(Math.abs(stats.delta))} g`
                  : '—'
              }
            />
          </div>
          {ascending.length >= 2 ? (
            <div className="rounded-md border bg-muted/20 p-3">
              <LineChart
                data={[
                  {
                    name: 'g',
                    points: ascending.map((p) => ({
                      x: p.recorded_at,
                      y: toGrams(Number(p.weight_kg))
                    }))
                  }
                ]}
                height={280}
                yLabel="g"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ascending.length === 0 ? t('emptyHint') : td('needMoreWeightPoints')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{td('weightLogs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('emptyHint')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">{fmt.format(toGrams(Number(l.weight_kg)))} g</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(l.recorded_at)} · {l.submitter?.full_name ?? '—'}
                    </div>
                  </div>
                  {l.notes && (
                    <p className="max-w-md text-right text-xs italic text-muted-foreground whitespace-pre-wrap">
                      {l.notes}
                    </p>
                  )}
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
