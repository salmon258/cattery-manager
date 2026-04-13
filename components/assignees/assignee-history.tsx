'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowRight, History } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type HistoryEntry = {
  id: string;
  changed_at: string;
  note: string | null;
  from_assignee: { id: string; full_name: string } | null;
  to_assignee:   { id: string; full_name: string } | null;
  changer:       { id: string; full_name: string } | null;
};

export function AssigneeHistory({ catId }: { catId: string }) {
  const t  = useTranslations('assignees');
  const tc = useTranslations('common');

  const { data: entries = [], isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ['assignee-history', catId],
    queryFn: async () => {
      const r = await fetch(`/api/cats/${catId}/assignee-history`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).entries;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          {t('historyTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">{tc('loading')}</p>}
        {!isLoading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
        )}
        {entries.length > 0 && (
          <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
            {entries.map((e) => (
              <li key={e.id} className="border-l-2 border-muted pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">
                    {e.from_assignee?.full_name ?? t('unassigned')}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">
                    {e.to_assignee?.full_name ?? t('unassigned')}
                  </span>
                  {e.note === 'batch' && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1 py-0.5 rounded">
                      batch
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(e.changed_at).toLocaleString()}
                  {e.changer && <> · {t('historyBy', { name: e.changer.full_name })}</>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
