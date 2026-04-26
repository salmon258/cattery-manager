'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Receipt, CheckCircle2, XCircle, Paperclip, Trash2, Edit, Filter
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
  ReimbursementRequest, ReimbursementCategory, ReimbursementStatus,
  PaymentMethod
} from './types';
import { PAYMENT_METHODS, REIMBURSEMENT_STATUSES } from './types';
import { formatMoney } from './format';
import { ReimbursementStatusBadge } from './my-payroll-client';

interface Props {
  defaultCurrency: string;
}

async function fetchAll(filter: string): Promise<ReimbursementRequest[]> {
  const qs = new URLSearchParams();
  if (filter && filter !== 'all') qs.set('status', filter);
  const r = await fetch(`/api/finance/reimbursements?${qs.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).requests;
}

async function fetchCategories(): Promise<ReimbursementCategory[]> {
  const r = await fetch('/api/finance/reimbursement-categories?include_inactive=1', {
    cache: 'no-store'
  });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).categories;
}

export function ReimbursementsAdmin({ defaultCurrency }: Props) {
  const tr = useTranslations('finance.reimbursement');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [filter, setFilter] = useState<'all' | ReimbursementStatus>('pending');
  const [reviewing, setReviewing] = useState<ReimbursementRequest | null>(null);
  const [paying, setPaying] = useState<ReimbursementRequest | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-reimbursements', filter],
    queryFn: () => fetchAll(filter)
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['reimbursement-categories', 'admin'],
    queryFn: fetchCategories
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/reimbursements/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('deleted'));
      qc.invalidateQueries({ queryKey: ['admin-reimbursements'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  async function openReceipt(id: string) {
    try {
      const r = await fetch(`/api/finance/reimbursements/${id}/receipt`);
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      const { url } = await r.json();
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function openPaymentProof(id: string) {
    try {
      const r = await fetch(`/api/finance/reimbursements/${id}/payment-proof`);
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
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{tr('adminTitle')}</h2>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('filter.all')}</SelectItem>
                {REIMBURSEMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tr(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(true)}>
            {tr('manageCategories')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent>
        </Card>
      )}
      {!isLoading && requests.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">{tr('emptyAdmin')}</CardContent>
        </Card>
      )}

      <div className="grid gap-2">
        {requests.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.profile?.full_name ?? '—'}</span>
                    <ReimbursementStatusBadge status={r.status} />
                    <Badge variant="outline">{r.category?.name ?? tr('uncategorized')}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tr('expenseDate')}: {r.expense_date}
                    {r.payment_date ? ` · ${tr('paidOn', { date: r.payment_date })}` : ''}
                  </div>
                  {r.description && (
                    <div className="text-xs text-foreground/80">{r.description}</div>
                  )}
                  {r.review_notes && (
                    <div className="text-xs italic text-muted-foreground">
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                {r.receipt_path && (
                  <Button size="sm" variant="outline" onClick={() => openReceipt(r.id)}>
                    <Paperclip className="h-4 w-4" /> {tr('viewReceipt')}
                  </Button>
                )}
                {r.payment_proof_path && (
                  <Button size="sm" variant="outline" onClick={() => openPaymentProof(r.id)}>
                    <Paperclip className="h-4 w-4" /> {tr('viewPaymentProof')}
                  </Button>
                )}
                {r.status === 'pending' && (
                  <Button size="sm" onClick={() => setReviewing(r)}>
                    {tr('review')}
                  </Button>
                )}
                {r.status === 'approved' && (
                  <Button size="sm" onClick={() => setPaying(r)}>
                    <CheckCircle2 className="h-4 w-4" /> {tr('markPaid')}
                  </Button>
                )}
                {r.status !== 'paid' && (
                  <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(tr('confirmDelete'))) del.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReviewModal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        request={reviewing}
        categories={categories}
        defaultCurrency={defaultCurrency}
      />
      <PayModal
        open={!!paying}
        onClose={() => setPaying(null)}
        request={paying}
      />
      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={categories}
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

function ReviewModal({
  open,
  onClose,
  request,
  categories,
  defaultCurrency
}: {
  open: boolean;
  onClose: () => void;
  request: ReimbursementRequest | null;
  categories: ReimbursementCategory[];
  defaultCurrency: string;
}) {
  const tr = useTranslations('finance.reimbursement');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [expenseDate, setExpenseDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');

  useEffect(() => {
    if (!request) return;
    setCategoryId(request.category_id ?? '');
    setAmount(String(request.amount ?? ''));
    setCurrency(request.currency ?? defaultCurrency);
    setExpenseDate(request.expense_date ?? '');
    setDescription(request.description ?? '');
    setReviewNotes(request.review_notes ?? '');
  }, [request, defaultCurrency]);

  const update = useMutation({
    mutationFn: async (status: ReimbursementStatus | undefined) => {
      if (!request) throw new Error('No request');
      const body: Record<string, unknown> = {
        category_id: categoryId || null,
        amount: Number(amount),
        currency,
        expense_date: expenseDate,
        description: description || null,
        review_notes: reviewNotes || null
      };
      if (status) body.status = status;
      const r = await fetch(`/api/finance/reimbursements/${request.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: (_, status) => {
      if (status === 'approved') toast.success(tr('approved'));
      else if (status === 'rejected') toast.success(tr('rejected'));
      else toast.success(tr('updated'));
      qc.invalidateQueries({ queryKey: ['admin-reimbursements'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  if (!request) return null;
  const isPending = request.status === 'pending';

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={tr('reviewTitle')}
      description={request.profile?.full_name ?? undefined}
    >
      <div className="space-y-3 py-2">
        <Field label={tr('fields.category')}>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={tr('fields.pickCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((c) => c.is_active || c.id === categoryId)
                .map((c) => (
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
            />
          </Field>
          <Field label={tr('fields.currency')}>
            <Input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </Field>
        </div>
        <Field label={tr('fields.expenseDate')}>
          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </Field>
        <Field label={tr('fields.description')}>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={tr('fields.reviewNotes')}>
          <Textarea
            rows={2}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder={tr('fields.reviewNotesHint')}
          />
        </Field>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => update.mutate(undefined)}
            disabled={update.isPending}
          >
            {tc('save')}
          </Button>
          {isPending && (
            <>
              <Button
                type="button"
                variant="destructive"
                onClick={() => update.mutate('rejected')}
                disabled={update.isPending}
              >
                <XCircle className="h-4 w-4" /> {tr('reject')}
              </Button>
              <Button
                type="button"
                onClick={() => update.mutate('approved')}
                disabled={update.isPending}
              >
                <CheckCircle2 className="h-4 w-4" /> {tr('approve')}
              </Button>
            </>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}

function PayModal({
  open,
  onClose,
  request
}: {
  open: boolean;
  onClose: () => void;
  request: ReimbursementRequest | null;
}) {
  const tr = useTranslations('finance.reimbursement');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error('No request');
      if (!file) throw new Error(tr('errors.proofRequired'));
      const fd = new FormData();
      fd.append('file', file);
      fd.append('payment_date', paymentDate);
      fd.append('payment_method', method);
      fd.append('payment_reference', reference);
      fd.append('mark_paid', '1');
      const r = await fetch(`/api/finance/reimbursements/${request.id}/payment-proof`, {
        method: 'POST',
        body: fd
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('paidSuccess'));
      qc.invalidateQueries({ queryKey: ['admin-reimbursements'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      setFile(null);
      setReference('');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  if (!request) return null;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={tr('payTitle')}
    >
      <div className="space-y-3 py-2">
        <div className="rounded-md border bg-muted/40 p-2 text-sm">
          <div className="font-medium">{request.profile?.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {request.category?.name} · {formatMoney(request.amount)} {request.currency}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr('fields.paymentDate')}>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </Field>
          <Field label={tr('fields.paymentMethod')}>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {tr(`method.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={tr('fields.paymentReference')}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={tr('fields.paymentProof')}>
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
            {m.isPending ? tc('saving') : tr('confirmPaid')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function CategoriesModal({
  open,
  onClose,
  categories
}: {
  open: boolean;
  onClose: () => void;
  categories: ReimbursementCategory[];
}) {
  const tr = useTranslations('finance.reimbursement');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/finance/reimbursement-categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, sort_order: 500 })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('category.created'));
      setName('');
      qc.invalidateQueries({ queryKey: ['reimbursement-categories'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/reimbursement-categories/${id}`, {
        method: 'DELETE'
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(tr('category.deleted'));
      qc.invalidateQueries({ queryKey: ['reimbursement-categories'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={tr('categoriesTitle')}
    >
      <div className="space-y-3 py-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>{tr('category.name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            {tc('add')}
          </Button>
        </div>
        <div className="space-y-1">
          {categories.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1 text-xs ${
                !c.is_active ? 'opacity-50' : ''
              }`}
            >
              <span className="truncate">
                {c.name}
                {c.is_system ? (
                  <Badge variant="outline" className="ml-2">
                    {tr('category.system')}
                  </Badge>
                ) : null}
              </span>
              {!c.is_system && c.is_active && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(tr('category.confirmDelete'))) remove.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </ResponsiveModal>
  );
}
