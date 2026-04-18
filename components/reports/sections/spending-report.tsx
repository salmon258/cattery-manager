'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SummaryRow {
  period_month: string; // date
  type: 'income' | 'expense';
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  currency: string;
  txn_count: number;
  total_amount: number;
}

type TxnRow = {
  [key: string]: unknown;
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  transaction_date: string;
  description: string | null;
  reference_number: string | null;
  auto_generated: boolean;
  related_entity_type: string | null;
  related_entity_id: string | null;
  category: { id: string; name: string; slug: string | null; type: string } | null;
}

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function SpendingReport() {
  const t = useTranslations('stock.reports');
  const [range, setRange] = useState<DateRange>(defaultRange());

  const { data: summary = [], isLoading: loadingSummary } = useQuery({
    queryKey: ['finance-summary', range.from, range.to],
    queryFn: async (): Promise<SummaryRow[]> => {
      const qs = new URLSearchParams({
        from: `${range.from.slice(0, 7)}-01`,
        to: range.to,
        type: 'expense'
      });
      const r = await fetch(`/api/finance/summary?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  const { data: txns = [], isLoading: loadingTxns } = useQuery({
    queryKey: ['finance-transactions', range.from, range.to],
    queryFn: async (): Promise<TxnRow[]> => {
      const qs = new URLSearchParams({
        type: 'expense',
        from: range.from,
        to: range.to,
        limit: '500'
      });
      const r = await fetch(`/api/finance/transactions?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).transactions;
    }
  });

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; currency: string; total: number; count: number }>();
    for (const row of summary) {
      const key = `${row.category_slug ?? row.category_name ?? 'uncategorized'}::${row.currency}`;
      const existing = map.get(key);
      const total = Number(row.total_amount) + (existing?.total ?? 0);
      const count = Number(row.txn_count) + (existing?.count ?? 0);
      map.set(key, {
        name: row.category_name ?? 'Uncategorized',
        currency: row.currency,
        total,
        count
      });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [summary]);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of byCategory) {
      map.set(row.currency, (map.get(row.currency) ?? 0) + row.total);
    }
    return Array.from(map.entries());
  }, [byCategory]);

  function exportCsv() {
    const csv = toCsv(txns, [
      { key: 'transaction_date', header: 'Date' },
      { key: 'type', header: 'Type' },
      {
        key: 'category',
        header: 'Category',
        format: (v) => (v as TxnRow['category'])?.name ?? ''
      },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'description', header: 'Description' },
      { key: 'reference_number', header: 'Reference' },
      { key: 'auto_generated', header: 'Auto' }
    ]);
    downloadCsv(`spending-${range.from}-to-${range.to}`, csv);
  }

  const isLoading = loadingSummary || loadingTxns;

  return (
    <ReportShell
      title={t('title')}
      description={t('subtitle')}
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={txns.length === 0}
    >
      <div className="space-y-5">
        {/* Totals */}
        <div className="grid gap-3 sm:grid-cols-2">
          {totalsByCurrency.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {t('noSpending')}
              </CardContent>
            </Card>
          )}
          {totalsByCurrency.map(([currency, total]) => (
            <Card key={currency}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{t('totalSpent')}</div>
                <div className="text-2xl font-semibold">
                  {formatMoney(total)} {currency}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* By category */}
        <section>
          <h3 className="text-sm font-semibold mb-2">{t('byCategory')}</h3>
          {byCategory.length === 0 && !isLoading ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {t('noSpending')}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {byCategory.map((row, i) => (
                <Card key={i}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.count} {t('txnCount', { count: row.count })}
                      </div>
                    </div>
                    <div className="font-medium whitespace-nowrap">
                      {formatMoney(row.total)} {row.currency}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent transactions */}
        <section>
          <h3 className="text-sm font-semibold mb-2">{t('recent')}</h3>
          {txns.length === 0 && !isLoading ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {t('noSpending')}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {txns.slice(0, 50).map((tx) => (
                <Card key={tx.id}>
                  <CardContent className="p-3 text-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tx.category?.name ?? t('uncategorized')}</span>
                        {tx.auto_generated && <Badge variant="secondary">{t('auto')}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tx.transaction_date}{tx.description ? ` · ${tx.description}` : ''}
                      </div>
                    </div>
                    <div className="whitespace-nowrap font-medium">
                      {formatMoney(Number(tx.amount))} {tx.currency}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </ReportShell>
  );
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}
