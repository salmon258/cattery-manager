'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { HeartPulse } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, formatDate } from '@/lib/utils';
import { HealthTicketModal } from '@/components/health/health-ticket-modal';

type TicketListRow = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
  cat: { id: string; name: string; profile_photo_url: string | null } | null;
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

async function fetchTickets(severity?: string): Promise<TicketListRow[]> {
  const params = severity && severity !== 'all' ? `?severity=${severity}` : '';
  const r = await fetch(`/api/health-tickets${params}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).tickets;
}

export default function HealthTicketsPage() {
  const t  = useTranslations('healthTickets');
  const tc = useTranslations('common');

  const [severity, setSeverity] = useState('all');
  const [viewTicketId, setViewTicketId] = useState<string | null>(null);

  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ['health-tickets-all', severity],
    queryFn:  () => fetchTickets(severity)
  });

  const sorted = [...tickets].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-muted-foreground" />
          {t('allTickets')}
        </h1>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSeverities')}</SelectItem>
            {(['critical', 'high', 'medium', 'low'] as const).map((s) => (
              <SelectItem key={s} value={s}>{t(`severities.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-normal">
            {isLoading
              ? tc('loading')
              : `${sorted.length} ${sorted.length === 1 ? 'ticket' : 'tickets'}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{tc('error')}</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noOpenTickets')}</p>
          ) : (
            <ul className="divide-y">
              {sorted.map((tk) => (
                <li key={tk.id}>
                  <button
                    type="button"
                    onClick={() => setViewTicketId(tk.id)}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-accent/50 transition-colors rounded-sm px-1"
                  >
                    {tk.cat && (
                      <Avatar className="h-8 w-8 shrink-0">
                        {tk.cat.profile_photo_url ? (
                          <AvatarImage src={tk.cat.profile_photo_url} alt={tk.cat.name} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {tk.cat.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{tk.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        {tk.cat && (
                          <span className="font-medium text-foreground/70">{tk.cat.name}</span>
                        )}
                        <span>·</span>
                        <span>{formatDate(tk.created_at)}</span>
                        {tk.creator && (
                          <>
                            <span>·</span>
                            <span>{tk.creator.full_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={cn('border-0 capitalize text-xs', severityClass(tk.severity))}>
                        {t(`severities.${tk.severity}`)}
                      </Badge>
                      <Badge className={cn('border-0 capitalize text-xs', statusClass(tk.status))}>
                        {t(`statuses.${tk.status}`)}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {viewTicketId && (
        <HealthTicketModal
          ticketId={viewTicketId}
          open={!!viewTicketId}
          onClose={() => setViewTicketId(null)}
          role="admin"
          invalidateKey={['health-tickets-all', severity]}
        />
      )}
    </div>
  );
}
