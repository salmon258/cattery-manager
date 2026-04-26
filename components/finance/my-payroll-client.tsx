'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Wallet, CheckCircle2, Clock, XCircle, Paperclip, ExternalLink,
  Plus, Receipt, Sparkles, Trash2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

import type {
  PayrollEntry, ProfileSalary, PayrollStatus,
  ReimbursementRequest, ReimbursementCategory, ReimbursementStatus,
  AdhocPayment, AdhocPaymentStatus
} from './types';
import { formatMoney } from './format';

interface Props {
  defaultCurrency: string;
}

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

async function fetchMyReimbursements(): Promise<ReimbursementRequest[]> {
  const r = await fetch('/api/finance/reimbursements/me', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).requests;
}

async function fetchMyAdhoc(): Promise<AdhocPayment[]> {
  const r = await fetch('/api/finance/adhoc-payments/me', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).payments;
}

async function fetchReimbursementCategories(): Promise<ReimbursementCategory[]> {
  const r = await fetch('/api/finance/reimbursement-categories', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load categories');
  return (await r.json()).categories;
}

export function MyPayrollClient({ defaultCurrency }: Props) {
  const t = useTranslations('finance.myPayroll');
  const tp = useTranslations('finance.payroll');
  const tr = useTranslations('finance.reimbursement');
  const ta = useTranslations('finance.adhoc');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const { data: payroll, isLoading } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: fetchMe
  });
  const { data: reimbursements = [], isLoading: reLoading } = useQuery({
    queryKey: ['my-reimbursements'],
    queryFn: fetchMyReimbursements
  });
  const { data: adhoc = [], isLoading: adLoading } = useQuery({
    queryKey: ['my-adhoc'],
    queryFn: fetchMyAdhoc
  });

  const entries = payroll?.entries ?? [];
  const salary = payroll?.current_salary ?? null;
  const [proposeOpen, setProposeOpen] = useState(false);

  async function openProof(id: string) {
    try {
      const url = await fetchProof(id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function openReimbursementReceipt(id: string) {
    try {
      const r = await fetch(`/api/finance/reimbursements/${id}/receipt`);
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      const { url } = await r.json();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function openReimbursementPaymentProof(id: string) {
    try {
      const r = await fetch(`/api/finance/reimbursements/${id}/payment-proof`);
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      const { url } = await r.json();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function openAdhocPaymentProof(id: string) {
    try {
      const r = await fetch(`/api/finance/adhoc-payments/${id}/payment-proof`);
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      const { url } = await r.json();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const cancelReimbursement = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/reimbursements/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('cancelled'));
      qc.invalidateQueries({ queryKey: ['my-reimbursements'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const deleteReimbursement = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/reimbursements/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('deleted'));
      qc.invalidateQueries({ queryKey: ['my-reimbursements'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-500" /> {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setProposeOpen(true)}>
          <Plus className="h-4 w-4" /> {tr('propose')}
        </Button>
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

      {/* Monthly payroll */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('payrollSection')}</h2>
          <Badge variant="secondary">{entries.length}</Badge>
        </div>
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
                      <PayrollStatusBadge status={e.status} />
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
      </section>

      {/* Reimbursements */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{tr('myTitle')}</h2>
          <Badge variant="secondary">{reimbursements.length}</Badge>
        </div>
        {reLoading && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent>
          </Card>
        )}
        {!reLoading && reimbursements.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">{tr('empty')}</CardContent>
          </Card>
        )}
        <div className="grid gap-2">
          {reimbursements.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {r.category?.name ?? tr('uncategorized')}
                      </span>
                      <ReimbursementStatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tr('expenseDate')}: {r.expense_date}
                      {r.payment_date ? ` · ${tr('paidOn', { date: r.payment_date })}` : ''}
                    </div>
                    {r.description && (
                      <div className="text-xs text-foreground/80">{r.description}</div>
                    )}
                    {r.review_notes && r.status === 'rejected' && (
                      <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900">
                        <AlertCircle className="inline h-3 w-3 mr-1" />
                        {tr('reviewNotes')}: {r.review_notes}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">
                      {formatMoney(r.amount)} {r.currency}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.receipt_path && (
                    <Button size="sm" variant="outline" onClick={() => openReimbursementReceipt(r.id)}>
                      <Paperclip className="h-4 w-4" /> {tr('viewReceipt')}
                    </Button>
                  )}
                  {r.payment_proof_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openReimbursementPaymentProof(r.id)}
                    >
                      <Paperclip className="h-4 w-4" /> {tr('viewPaymentProof')}
                    </Button>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(tr('confirmCancel'))) cancelReimbursement.mutate(r.id);
                        }}
                      >
                        <XCircle className="h-4 w-4" /> {tc('cancel')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(tr('confirmDelete'))) deleteReimbursement.mutate(r.id);
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

      {/* Adhoc payments */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{ta('myTitle')}</h2>
          <Badge variant="secondary">{adhoc.length}</Badge>
        </div>
        {adLoading && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent>
          </Card>
        )}
        {!adLoading && adhoc.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">{ta('empty')}</CardContent>
          </Card>
        )}
        <div className="grid gap-2">
          {adhoc.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.kind}</span>
                      <AdhocStatusBadge status={a.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.payment_date}
                      {a.finance_category?.name ? ` · ${a.finance_category.name}` : ''}
                    </div>
                    {a.description && (
                      <div className="text-xs text-foreground/80">{a.description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">
                      {formatMoney(a.amount)} {a.currency}
                    </div>
                  </div>
                </div>
                {a.payment_proof_path && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAdhocPaymentProof(a.id)}
                  >
                    <Paperclip className="h-4 w-4" /> {ta('viewPaymentProof')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <ProposeReimbursementModal
        open={proposeOpen}
        onClose={() => setProposeOpen(false)}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}

function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
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

export function ReimbursementStatusBadge({ status }: { status: ReimbursementStatus }) {
  const t = useTranslations('finance.reimbursement.status');
  switch (status) {
    case 'paid':
      return (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> {t(status)}
        </Badge>
      );
    case 'approved':
      return (
        <Badge className="gap-1 bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300">
          <CheckCircle2 className="h-3 w-3" /> {t(status)}
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> {t(status)}
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="gap-1">
          <XCircle className="h-3 w-3" /> {t(status)}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> {t(status)}
        </Badge>
      );
  }
}

export function AdhocStatusBadge({ status }: { status: AdhocPaymentStatus }) {
  const t = useTranslations('finance.adhoc.status');
  if (status === 'paid') {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> {t(status)}
      </Badge>
    );
  }
  if (status === 'cancelled') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> {t(status)}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> {t(status)}
    </Badge>
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

function ProposeReimbursementModal({
  open,
  onClose,
  defaultCurrency
}: {
  open: boolean;
  onClose: () => void;
  defaultCurrency: string;
}) {
  const tr = useTranslations('finance.reimbursement');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [expenseDate, setExpenseDate] = useState<string>(today);
  const [description, setDescription] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['reimbursement-categories'],
    queryFn: fetchReimbursementCategories
  });

  function reset() {
    setCategoryId('');
    setAmount('');
    setCurrency(defaultCurrency);
    setExpenseDate(today);
    setDescription('');
    setFile(null);
  }

  const submit = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error(tr('errors.amountInvalid'));
      }
      const fd = new FormData();
      fd.append(
        'payload',
        JSON.stringify({
          category_id: categoryId || null,
          amount: amt,
          currency,
          expense_date: expenseDate,
          description: description || null
        })
      );
      if (file) fd.append('file', file);
      const r = await fetch('/api/finance/reimbursements', { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('proposed'));
      qc.invalidateQueries({ queryKey: ['my-reimbursements'] });
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
      title={tr('proposeTitle')}
      description={tr('proposeSubtitle')}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="space-y-3 py-2"
      >
        <Field label={tr('fields.category')}>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={tr('fields.pickCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr('fields.amount')}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label={tr('fields.currency')}>
            <Input
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              required
            />
          </Field>
        </div>
        <Field label={tr('fields.expenseDate')}>
          <Input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
          />
        </Field>
        <Field label={tr('fields.description')}>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr('fields.descriptionHint')}
          />
        </Field>
        <Field label={tr('fields.receipt')}>
          <Input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? tc('saving') : tr('submit')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
