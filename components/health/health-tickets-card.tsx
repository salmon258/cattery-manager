'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { HeartPulse, Plus } from 'lucide-react';

import type { UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { OpenTicketModal } from '@/components/health/open-ticket-modal';
import { HealthTicketModal } from '@/components/health/health-ticket-modal';

type TicketRow = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  creator: { id: string; full_name: string } | null;
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function severityClass(s: string) {
  return {
    low:      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    medium:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }[s] ?? '';
}

function statusClass(s: string) {
  return {
    open:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }[s] ?? '';
}

async function fetchTickets(catId: string): Promise<TicketRow[]> {
  const r = await fetch(`/api/cats/${catId}/health-tickets`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).tickets;
}

interface Props {
  catId: string;
  role: UserRole;
}

export function HealthTicketsCard({ catId, role }: Props) {
  const t  = useTranslations('healthTickets');
  const tc = useTranslations('common');

  const [openCreate, setOpenCreate] = useState(false);
  const [viewTicketId, setViewTicketId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['health-tickets', catId],
    queryFn:  () => fetchTickets(catId)
  });

  const open = useMemo(
    () =>
      all
        .filter((t) => t.status !== 'resolved')
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [all]
  );
  const resolved = useMemo(
    () => all.filter((t) => t.status === 'resolved'),
    [all]
  );

  function TicketRow({ ticket }: { ticket: TicketRow }) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setViewTicketId(ticket.id)}
          className="w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
        >
          <div className="min-w-0">
            <div className="font-medium truncate flex items-center gap-2 flex-wrap">
              {ticket.title}
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={cn('border-0 capitalize text-xs', severityClass(ticket.severity))}>
              {t(`severities.${ticket.severity}`)}
            </Badge>
            <Badge className={cn('border-0 capitalize text-xs', statusClass(ticket.status))}>
              {t(`statuses.${ticket.status}`)}
            </Badge>
          </div>
        </button>
      </li>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-l-4 border-l-rose-400 bg-gradient-to-r from-rose-50/50 to-transparent dark:from-rose-950/20 md:col-span-2">
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-rose-500" />
            {t('title')}
            {open.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {t('openCount', { n: open.length })}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setOpenCreate(true)}
            className="bg-rose-500 text-white shadow hover:bg-rose-600"
          >
            <Plus className="h-4 w-4" /> {t('openTicket')}
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{tc('loading')}</p>
          ) : (
            <>
              {/* Open / in-progress tickets */}
              {open.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noOpenTickets')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {open.map((tk) => <TicketRow key={tk.id} ticket={tk} />)}
                </ul>
              )}

              {/* Resolved tickets — collapsible */}
              {resolved.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowResolved((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showResolved
                      ? t('hideResolved')
                      : t('showResolved', { n: resolved.length })}
                  </button>
                  {showResolved && (
                    <ul className="mt-2 space-y-1.5">
                      {resolved.map((tk) => <TicketRow key={tk.id} ticket={tk} />)}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <OpenTicketModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        catId={catId}
      />

      {viewTicketId && (
        <HealthTicketModal
          ticketId={viewTicketId}
          open={!!viewTicketId}
          onClose={() => setViewTicketId(null)}
          role={role}
          invalidateKey={['health-tickets', catId]}
        />
      )}
    </>
  );
}
