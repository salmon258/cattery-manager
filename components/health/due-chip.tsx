'use client';

import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DueStatus = 'overdue' | 'due-soon' | 'ok' | 'none';

export function computeDueStatus(
  nextDueISO: string | null | undefined,
  dueSoonDays = 14
): { status: DueStatus; daysDiff: number | null } {
  if (!nextDueISO) return { status: 'none', daysDiff: null };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(nextDueISO);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { status: 'overdue', daysDiff: diff };
  if (diff <= dueSoonDays) return { status: 'due-soon', daysDiff: diff };
  return { status: 'ok', daysDiff: diff };
}

/** Pill badge that surfaces next-due status. Works for vaccines + preventive treatments. */
export function DueChip({
  nextDueISO,
  dueSoonDays = 14,
  labels
}: {
  nextDueISO: string | null | undefined;
  dueSoonDays?: number;
  labels: { overdue: string; dueSoon: string; ok: string; none: string; inDays: (n: number) => string; agoDays: (n: number) => string };
}) {
  const { status, daysDiff } = computeDueStatus(nextDueISO, dueSoonDays);

  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium';
  if (status === 'overdue') {
    return (
      <span className={cn(base, 'bg-destructive/10 text-destructive')}>
        <AlertCircle className="h-3 w-3" /> {labels.overdue} · {labels.agoDays(Math.abs(daysDiff!))}
      </span>
    );
  }
  if (status === 'due-soon') {
    return (
      <span className={cn(base, 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
        <Clock className="h-3 w-3" /> {labels.dueSoon} · {labels.inDays(daysDiff!)}
      </span>
    );
  }
  if (status === 'ok') {
    return (
      <span className={cn(base, 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
        <CheckCircle2 className="h-3 w-3" /> {labels.ok}
      </span>
    );
  }
  return <span className={cn(base, 'bg-muted text-muted-foreground')}>{labels.none}</span>;
}
