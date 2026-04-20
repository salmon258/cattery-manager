'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Plus, Wallet, Receipt, TrendingDown, TrendingUp, Users, Sparkles,
  Trash2, Edit, Filter, Download, Paperclip
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { financialTransactionSchema, type FinancialTransactionInput } from '@/lib/schemas/finance';
import { downloadCsv, toCsv } from '@/lib/export/csv';

import type {
  FinancialTransaction, TransactionCategory, FinancialType, PaymentMethod
} from './types';
import { PAYMENT_METHODS } from './types';
import { formatMoney, firstOfMonth, lastOfMonth, monthsAgo } from './format';

interface Props {
  defaultCurrency: string;
}

interface SummaryRow {
  period_month: string;
  type: FinancialType;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  currency: string;
  txn_count: number;
  total_amount: number;
}

async function fetchCategories(): Promise<TransactionCategory[]> {
  const r = await fetch('/api/finance/categories?include_inactive=1', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load categories');
  return (await r.json()).categories;
}

function fmtDate(d: string) {
  return d;
}

export function FinanceClient({ defaultCurrency }: Props) {
  const t = useTranslations('finance');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [range, setRange] = useState({ from: monthsAgo(5), to: lastOfMonth() });
  const [filterType, setFilterType] = useState<'all' | FinancialType>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAuto, setFilterAuto] = useState<'all' | 'manual' | 'auto'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<FinancialType>('expense');
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['finance-categories'],
    queryFn: fetchCategories
  });

  const { data: summary = [] } = useQuery({
    queryKey: ['finance-summary', range.from, range.to],
    queryFn: async (): Promise<SummaryRow[]> => {
      const qs = new URLSearchParams({ from: range.from, to: range.to });
      const r = await fetch(`/api/finance/summary?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).rows;
    }
  });

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ['finance-transactions', range.from, range.to, filterType, filterCategory],
    queryFn: async (): Promise<FinancialTransaction[]> => {
      const qs = new URLSearchParams({ from: range.from, to: range.to, limit: '500' });
      if (filterType !== 'all') qs.set('type', filterType);
      if (filterCategory !== 'all') qs.set('category_id', filterCategory);
      const r = await fetch(`/api/finance/transactions?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).transactions;
    }
  });

  const visibleTxns = useMemo(
    () =>
      txns.filter((x) => {
        if (filterAuto === 'manual' && x.auto_generated) return false;
        if (filterAuto === 'auto' && !x.auto_generated) return false;
        return true;
      }),
    [txns, filterAuto]
  );

  const totalsByType = useMemo(() => {
    // map: `${type}|${currency}` -> amount
    const map = new Map<string, number>();
    for (const r of summary) {
      const key = `${r.type}|${r.currency}`;
      map.set(key, (map.get(key) ?? 0) + Number(r.total_amount));
    }
    return map;
  }, [summary]);

  function totalFor(type: FinancialType, currency: string) {
    return totalsByType.get(`${type}|${currency}`) ?? 0;
  }

  const currenciesInRange = useMemo(() => {
    const s = new Set<string>();
    for (const r of summary) s.add(r.currency);
    if (!s.size) s.add(defaultCurrency);
    return Array.from(s);
  }, [summary, defaultCurrency]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/transactions/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('txn.deleted'));
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function exportCsv() {
    const csv = toCsv(visibleTxns as unknown as Array<Record<string, unknown>>, [
      { key: 'transaction_date', header: 'Date' },
      { key: 'type', header: 'Type' },
      {
        key: 'category',
        header: 'Category',
        format: (v) => (v as FinancialTransaction['category'])?.name ?? ''
      },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'description', header: 'Description' },
      { key: 'reference_number', header: 'Reference' },
      { key: 'payment_method', header: 'Method' },
      { key: 'auto_generated', header: 'Auto' }
    ]);
    downloadCsv(`finance-${range.from}-to-${range.to}`, csv);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/finance/payroll">
              <Users className="h-4 w-4" /> {t('nav.payroll')}
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreateType('income');
              setCreateOpen(true);
            }}
          >
            <TrendingUp className="h-4 w-4" /> {t('actions.newIncome')}
          </Button>
          <Button
            onClick={() => {
              setCreateType('expense');
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t('actions.newExpense')}
          </Button>
        </div>
      </div>

      {/* Date range */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{tc('from')}</Label>
            <Input
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tc('to')}</Label>
            <Input
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('filter.type')}</Label>
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as typeof filterType)}
            >
              <SelectTrigger className="min-w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.allTypes')}</SelectItem>
                <SelectItem value="income">{t('type.income')}</SelectItem>
                <SelectItem value="expense">{t('type.expense')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('filter.category')}</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="min-w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.allCategories')}</SelectItem>
                {categories
                  .filter((c) => filterType === 'all' || c.type === filterType)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('filter.source')}</Label>
            <Select
              value={filterAuto}
              onValueChange={(v) => setFilterAuto(v as typeof filterAuto)}
            >
              <SelectTrigger className="min-w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filter.allSources')}</SelectItem>
                <SelectItem value="manual">{t('filter.manual')}</SelectItem>
                <SelectItem value="auto">{t('filter.auto')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={visibleTxns.length === 0}
            >
              <Download className="h-4 w-4" /> {tc('export')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {currenciesInRange.map((currency) => {
          const inc = totalFor('income', currency);
          const exp = totalFor('expense', currency);
          const net = inc - exp;
          return (
            <Card key={currency}>
              <CardContent className="p-4 space-y-3">
                <div className="text-xs text-muted-foreground">{t('totals.period')} · {currency}</div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" /> {t('totals.income')}
                  </span>
                  <span className="text-sm font-medium">{formatMoney(inc)} {currency}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                    <TrendingDown className="h-4 w-4" /> {t('totals.expense')}
                  </span>
                  <span className="text-sm font-medium">{formatMoney(exp)} {currency}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t pt-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4" /> {t('totals.net')}
                  </span>
                  <span className={`text-base font-semibold ${net < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatMoney(net)} {currency}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Transactions */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('ledger.title')}</h2>
          <Badge variant="secondary">{visibleTxns.length}</Badge>
        </div>
        {isLoading && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent>
          </Card>
        )}
        {!isLoading && visibleTxns.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">{t('ledger.empty')}</CardContent>
          </Card>
        )}
        <div className="grid gap-2">
          {visibleTxns.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="p-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                        tx.type === 'income'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {tx.type === 'income' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    </span>
                    <span className="font-medium">{tx.category?.name ?? t('uncategorized')}</span>
                    {tx.auto_generated && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" /> {t('auto')}
                      </Badge>
                    )}
                    {tx.related_entity_type && (
                      <Badge variant="outline">{t(`related.${tx.related_entity_type}`)}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {fmtDate(tx.transaction_date)}
                    {tx.description ? ` · ${tx.description}` : ''}
                    {tx.reference_number ? ` · #${tx.reference_number}` : ''}
                    {tx.payment_method ? ` · ${t(`method.${tx.payment_method}`)}` : ''}
                  </div>
                  {tx.receipt_url && (
                    <a
                      href={tx.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Paperclip className="h-3 w-3" /> {t('txn.receipt')}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`whitespace-nowrap font-medium ${tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {tx.type === 'expense' ? '−' : '+'}
                    {formatMoney(tx.amount)} {tx.currency}
                  </div>
                  {!tx.auto_generated && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(tx)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(t('txn.confirmDelete'))) del.mutate(tx.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Modals */}
      <TransactionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialType={createType}
        categories={categories}
        defaultCurrency={defaultCurrency}
      />
      <TransactionModal
        open={!!editing}
        onClose={() => setEditing(null)}
        txn={editing ?? undefined}
        categories={categories}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}

function TransactionModal({
  open,
  onClose,
  txn,
  initialType,
  categories,
  defaultCurrency
}: {
  open: boolean;
  onClose: () => void;
  txn?: FinancialTransaction;
  initialType?: FinancialType;
  categories: TransactionCategory[];
  defaultCurrency: string;
}) {
  const t = useTranslations('finance');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!txn;
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FinancialTransactionInput>({
    resolver: zodResolver(financialTransactionSchema),
    values: txn
      ? {
          type: txn.type,
          category_id: txn.category_id,
          amount: Number(txn.amount),
          currency: txn.currency,
          transaction_date: txn.transaction_date,
          description: txn.description ?? '',
          reference_number: txn.reference_number ?? '',
          receipt_url: txn.receipt_url ?? '',
          payment_method: txn.payment_method,
          related_entity_type: txn.related_entity_type,
          related_entity_id: txn.related_entity_id
        }
      : undefined,
    defaultValues: txn
      ? undefined
      : {
          type: initialType ?? 'expense',
          category_id: null,
          amount: 0,
          currency: defaultCurrency,
          transaction_date: today,
          description: '',
          reference_number: '',
          receipt_url: '',
          payment_method: null,
          related_entity_type: null,
          related_entity_id: null
        }
  });

  const type = form.watch('type');
  const filteredCats = categories.filter((c) => c.type === type && c.is_active);

  const m = useMutation({
    mutationFn: async (v: FinancialTransactionInput) => {
      // Null-out empty strings so zod + DB behave.
      const payload = {
        ...v,
        description: v.description || null,
        reference_number: v.reference_number || null,
        receipt_url: v.receipt_url || null,
        category_id: v.category_id || null,
        related_entity_type: v.related_entity_type || null,
        related_entity_id: v.related_entity_id || null,
        payment_method: v.payment_method || null
      };
      const r = await fetch(
        isEdit ? `/api/finance/transactions/${txn!.id}` : '/api/finance/transactions',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('txn.updated') : t('txn.created'));
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const uploadReceipt = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'receipt');
      fd.append('key', txn?.id ?? 'temp');
      const r = await fetch('/api/finance/attachments', { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Upload failed');
      return (await r.json()) as { url: string | null; path: string };
    },
    onSuccess: (d) => {
      if (d.url) form.setValue('receipt_url', d.url);
      toast.success(t('attachment.uploaded'));
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? t('txn.edit') : type === 'income' ? t('txn.newIncome') : t('txn.newExpense')}
    >
      <form
        onSubmit={form.handleSubmit(
          (v) => m.mutate(v),
          (errs) => {
            const first = Object.values(errs)[0];
            const msg = (first && (first as { message?: string }).message) || 'Invalid input';
            toast.error(msg);
          }
        )}
        className="space-y-3 py-2"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('txn.fields.type')}>
            <Select
              value={form.watch('type')}
              onValueChange={(v) => {
                form.setValue('type', v as FinancialType);
                form.setValue('category_id', null);
              }}
              disabled={isEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t('type.expense')}</SelectItem>
                <SelectItem value="income">{t('type.income')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('txn.fields.category')} error={errors.category_id?.message}>
            <Select
              value={form.watch('category_id') ?? ''}
              onValueChange={(v) => form.setValue('category_id', v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('txn.fields.pickCategory')} />
              </SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('txn.fields.amount')} error={errors.amount?.message}>
            <Input type="number" step="0.01" min="0" {...form.register('amount')} />
          </Field>
          <Field label={t('txn.fields.currency')} error={errors.currency?.message}>
            <Input maxLength={3} {...form.register('currency')} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('txn.fields.date')} error={errors.transaction_date?.message}>
            <Input type="date" {...form.register('transaction_date')} />
          </Field>
          <Field label={t('txn.fields.method')}>
            <Select
              value={form.watch('payment_method') ?? ''}
              onValueChange={(v) => form.setValue('payment_method', (v || null) as PaymentMethod | null)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('txn.fields.noMethod')} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{t(`method.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t('txn.fields.description')}>
          <Textarea rows={2} {...form.register('description')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('txn.fields.reference')}>
            <Input {...form.register('reference_number')} />
          </Field>
          <Field label={t('txn.fields.receipt')}>
            <div className="flex items-center gap-2">
              <Input
                placeholder="https://…"
                value={form.watch('receipt_url') ?? ''}
                onChange={(e) => form.setValue('receipt_url', e.target.value)}
              />
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">
                <Receipt className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadReceipt.mutate(f);
                  }}
                />
              </label>
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : isEdit ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
