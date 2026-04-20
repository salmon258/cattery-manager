'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Wallet, CheckCircle2, Clock, XCircle, Paperclip, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import type { PayrollEntry, ProfileSalary, PayrollStatus } from './types';
import { formatMoney } from './format';

async function fetchMe(): Promise<{ entries: PayrollEntry[]; current_salary: ProfileSalary | null }> {
  const r = await fetch('/api/finance/payroll/me', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

async function fetchProof(id: string): Promise<string> {
  const r = await fetch(`/api/finance/payroll/${id}/proof`, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
  return (await r.json()).url as string;
}

export function MyPayrollClient() {
  const t = useTranslations('finance.myPayroll');
  const tp = useTranslations('finance.payroll');
  const tc = useTranslations('common');

  const { data, isLoading } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: fetchMe
  });

  const entries = data?.entries ?? [];
  const salary = data?.current_salary ?? null;

  async function openProof(id: string) {
    try {
      const url = await fetchProof(id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-emerald-500" /> {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {salary && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">{t('currentSalary')}</div>
              <div className="text-xl font-semibold">
                {formatMoney(salary.monthly_salary)} {salary.currency}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('since', { date: salary.effective_from })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent>
        </Card>
      )}
      {!isLoading && entries.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {e.period_start} → {e.period_end}
                    </span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.payment_date
                      ? t('paidOn', { date: e.payment_date })
                      : t('pending')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {formatMoney(e.net_amount)} {e.currency}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tp('entry.grossLabel')}: {formatMoney(e.gross_amount)} · {tp('entry.bonusLabel')}:{' '}
                    {formatMoney(e.bonus_amount)} · {tp('entry.deductionLabel')}:{' '}
                    {formatMoney(e.deduction_amount)}
                  </div>
                </div>
              </div>
              {e.transfer_proof_path && (
                <Button size="sm" variant="outline" onClick={() => openProof(e.id)}>
                  <Paperclip className="h-4 w-4" /> {t('viewProof')}{' '}
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              {e.notes && (
                <div className="rounded-md border bg-muted/30 p-2 text-xs">{e.notes}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PayrollStatus }) {
  const t = useTranslations('finance.payroll');
  if (status === 'paid') {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> {t(`status.${status}`)}
      </Badge>
    );
  }
  if (status === 'cancelled') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> {t(`status.${status}`)}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> {t(`status.${status}`)}
    </Badge>
  );
}
