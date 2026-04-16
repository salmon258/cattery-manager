'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';

import type { MedRoute } from '@/lib/supabase/aliases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

async function fetchHistory(catId: string): Promise<HistoryEntry[]> {
  const r = await fetch(`/api/cats/${catId}/medication-history`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).entries;
}

const INITIAL_VISIBLE = 8;

export function MedicationHistoryCard({ catId }: { catId: string }) {
  const t = useTranslations('medications');
  const tc = useTranslations('common');
  const [showAll, setShowAll] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['medication-history', catId],
    queryFn: () => fetchHistory(catId)
  });

  const visible = showAll ? entries : entries.slice(0, INITIAL_VISIBLE);

  return (
    <Card className="overflow-hidden border-l-4 border-l-violet-300/70 bg-gradient-to-r from-violet-50/30 to-transparent dark:from-violet-950/10 md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-violet-400" />
          {t('history.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
        ) : (
          <>
            <ul className="space-y-2 text-sm">
              {visible.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 border-b pb-2 last:border-0"
                >
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
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
                    title={new Date(e.given_at).toISOString()}
                  >
                    {new Date(e.given_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            {entries.length > INITIAL_VISIBLE && (
              <div className="pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-violet-600 hover:text-violet-700 dark:text-violet-300"
                >
                  {showAll
                    ? t('history.showLess')
                    : t('history.showAll', { count: entries.length })}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatDose(e: HistoryEntry): string {
  if (e.dose && e.unit) return `${e.dose} ${e.unit}`;
  return e.dose ?? e.unit ?? '—';
}
