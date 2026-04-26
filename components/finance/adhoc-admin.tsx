'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Sparkles, Plus, CheckCircle2, Paperclip, Trash2, Edit, Filter
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

import type {
  AdhocPayment, AdhocPaymentStatus, FinanceProfileLite,
  PaymentMethod, TransactionCategory
} from './types';
import { PAYMENT_METHODS, ADHOC_PAYMENT_STATUSES } from './types';
import { formatMoney } from './format';
import { AdhocStatusBadge } from './my-payroll-client';

interface Props {
  defaultCurrency: string;
  profiles: FinanceProfileLite[];
}

async function fetchAdhoc(filter: string): Promise<AdhocPayment[]> {
  const qs = new URLSearchParams();
  if (filter && filter !== 'all') qs.set('status', filter);
  const r = await fetch(`/api/finance/adhoc-payments?${qs.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).payments;
}

async function fetchExpenseCategories(): Promise<TransactionCategory[]> {
  const r = await fetch('/api/finance/categories?type=expense', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).categories;
}

export function AdhocAdmin({ defaultCurrency, profiles }: Props) {
  const ta = useTranslations('finance.adhoc');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [filter, setFilter] = useState<'all' | AdhocPaymentStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdhocPayment | null>(null);
  const [paying, setPaying] = useState<AdhocPayment | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['admin-adhoc', filter],
    queryFn: () => fetchAdhoc(filter)
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: fetchExpenseCategories
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/adhoc-payments/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(ta('deleted'));
      qc.invalidateQueries({ queryKey: ['admin-adhoc'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  async function openProof(id: string) {
    try {
      const r = await fetch(`/api/finance/adhoc-payments/${id}/payment-proof`);
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      const { url } = await r.json();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{ta('adminTitle')}</h2>
          <Badge variant="secondary">{payments.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ta('filter.all')}</SelectItem>
                {ADHOC_PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ta(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {ta('new')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent>
        </Card>
      )}
      {!isLoading && payments.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{ta('emptyAdmin')}</CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {payments.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.profile?.full_name ?? '—'}</span>
                    <AdhocStatusBadge status={p.status} />
                    <Badge variant="outline">{p.kind}</Badge>
                    {p.finance_category?.name && (
                      <Badge variant="secondary">{p.finance_category.name}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.payment_date}</div>
                  {p.description && (
                    <div className="text-xs text-foreground/80">{p.description}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-base font-semibold">
                    {formatMoney(p.amount)} {p.currency}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {p.payment_proof_path && (
                  <Button size="sm" variant="outline" onClick={() => openProof(p.id)}>
                    <Paperclip className="h-4 w-4" /> {ta('viewPaymentProof')}
                  </Button>
                )}
                {p.status !== 'paid' && (
                  <Button size="sm" onClick={() => setPaying(p)}>
                    <CheckCircle2 className="h-4 w-4" /> {ta('markPaid')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(ta('confirmDelete'))) del.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateOrEditModal
        open={createOpen || !!editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        payment={editing}
        profiles={profiles}
        categories={categories}
        defaultCurrency={defaultCurrency}
      />
      <PayModal
        open={!!paying}
        onClose={() => setPaying(null)}
        payment={paying}
      />
    </div>
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

function CreateOrEditModal({
  open,
  onClose,
  payment,
  profiles,
  categories,
  defaultCurrency
}: {
  open: boolean;
  onClose: () => void;
  payment: AdhocPayment | null;
  profiles: FinanceProfileLite[];
  categories: TransactionCategory[];
  defaultCurrency: string;
}) {
  const ta = useTranslations('finance.adhoc');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!payment;
  const today = new Date().toISOString().slice(0, 10);

  const [profileId, setProfileId] = useState<string>('');
  const [kind, setKind] = useState('');
  const [financeCategoryId, setFinanceCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [paymentDate, setPaymentDate] = useState<string>(today);
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    if (payment) {
      setProfileId(payment.profile_id);
      setKind(payment.kind);
      setFinanceCategoryId(payment.finance_category_id ?? '');
      setAmount(String(payment.amount));
      setCurrency(payment.currency);
      setPaymentDate(payment.payment_date);
      setDescription(payment.description ?? '');
    } else {
      setProfileId(profiles[0]?.id ?? '');
      setKind('');
      setFinanceCategoryId('');
      setAmount('');
      setCurrency(defaultCurrency);
      setPaymentDate(today);
      setDescription('');
    }
    // We intentionally only resync on payment open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment, open]);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(ta('errors.amountInvalid'));
      if (!kind.trim()) throw new Error(ta('errors.kindRequired'));
      const body = {
        profile_id: profileId,
        kind: kind.trim(),
        finance_category_id: financeCategoryId || null,
        amount: amt,
        currency,
        payment_date: paymentDate,
        description: description || null,
        status: payment?.status ?? 'pending'
      };
      const r = await fetch(
        isEdit ? `/api/finance/adhoc-payments/${payment!.id}` : '/api/finance/adhoc-payments',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? ta('updated') : ta('created'));
      qc.invalidateQueries({ queryKey: ['admin-adhoc'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? ta('edit') : ta('new')}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="space-y-3 py-2"
      >
        <Field label={ta('fields.profile')}>
          <Select value={profileId} onValueChange={setProfileId} disabled={isEdit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={ta('fields.kind')}>
          <Input
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder={ta('fields.kindHint')}
            required
          />
        </Field>
        <Field label={ta('fields.financeCategory')}>
          <Select value={financeCategoryId} onValueChange={setFinanceCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={ta('fields.financeCategoryHint')} />
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
          <Field label={ta('fields.amount')}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label={ta('fields.currency')}>
            <Input
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              required
            />
          </Field>
        </div>
        <Field label={ta('fields.paymentDate')}>
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </Field>
        <Field label={ta('fields.description')}>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? tc('saving') : isEdit ? tc('save') : tc('create')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

function PayModal({
  open,
  onClose,
  payment
}: {
  open: boolean;
  onClose: () => void;
  payment: AdhocPayment | null;
}) {
  const ta = useTranslations('finance.adhoc');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (payment) {
      setPaymentDate(payment.payment_date || today);
      setMethod(payment.payment_method ?? 'bank_transfer');
      setReference(payment.payment_reference ?? '');
      setFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment]);

  const m = useMutation({
    mutationFn: async () => {
      if (!payment) throw new Error('No payment');
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('payment_date', paymentDate);
        fd.append('payment_method', method);
        fd.append('payment_reference', reference);
        fd.append('mark_paid', '1');
        const r = await fetch(`/api/finance/adhoc-payments/${payment.id}/payment-proof`, {
          method: 'POST',
          body: fd
        });
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      } else {
        // Mark paid without a proof file (optional).
        const r = await fetch(`/api/finance/adhoc-payments/${payment.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: 'paid',
            payment_date: paymentDate,
            payment_method: method,
            payment_reference: reference || null
          })
        });
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      }
    },
    onSuccess: () => {
      toast.success(ta('paidSuccess'));
      qc.invalidateQueries({ queryKey: ['admin-adhoc'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  if (!payment) return null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={ta('payTitle')}
    >
      <div className="space-y-3 py-2">
        <div className="rounded-md border bg-muted/40 p-2 text-sm">
          <div className="font-medium">{payment.profile?.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {payment.kind} · {formatMoney(payment.amount)} {payment.currency}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={ta('fields.paymentDate')}>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </Field>
          <Field label={ta('fields.paymentMethod')}>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ta(`method.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={ta('fields.paymentReference')}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={ta('fields.paymentProof')}>
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
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <CheckCircle2 className="h-4 w-4" />{' '}
            {m.isPending ? tc('saving') : ta('confirmPaid')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
