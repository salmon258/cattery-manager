'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Plus, Users, ArrowLeft, Edit, Trash2, CheckCircle2,
  Clock, XCircle, Paperclip, DollarSign, CalendarClock, Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  profileSalarySchema,
  payrollEntrySchema,
  type ProfileSalaryInput,
  type PayrollEntryInput
} from '@/lib/schemas/finance';

import type {
  PayrollEntry, ProfileSalary, FinanceProfileLite, PaymentMethod, PayrollStatus
} from './types';
import { PAYMENT_METHODS, PAYROLL_STATUSES } from './types';
import { formatMoney } from './format';

interface Props {
  defaultCurrency: string;
}

interface ProfileRow extends FinanceProfileLite {
  email?: string | null;
}

async function fetchProfiles(): Promise<ProfileRow[]> {
  const r = await fetch('/api/users', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load users');
  return (await r.json()).users as ProfileRow[];
}

async function fetchSalaries(): Promise<ProfileSalary[]> {
  const r = await fetch('/api/finance/salaries', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load salaries');
  return (await r.json()).salaries;
}

async function fetchEntries(from: string, to: string): Promise<PayrollEntry[]> {
  const qs = new URLSearchParams({ from, to });
  const r = await fetch(`/api/finance/payroll?${qs.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load payroll');
  return (await r.json()).entries;
}

function periodBoundsFor(ym: string) {
  // ym = 'YYYY-MM'
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export function PayrollClient({ defaultCurrency }: Props) {
  const t = useTranslations('finance.payroll');
  const tf = useTranslations('finance');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`
  );
  const bounds = periodBoundsFor(selectedMonth);
  const [rangeFrom, setRangeFrom] = useState(bounds.start);
  const [rangeTo, setRangeTo] = useState(bounds.end);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<ProfileSalary | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [payEntry, setPayEntry] = useState<PayrollEntry | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['finance-profiles'],
    queryFn: fetchProfiles
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['finance-salaries'],
    queryFn: fetchSalaries
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['finance-payroll', rangeFrom, rangeTo],
    queryFn: () => fetchEntries(rangeFrom, rangeTo)
  });

  // Latest salary per profile (for the "active salary" column + generate).
  const activeSalary = useMemo(() => {
    const map = new Map<string, ProfileSalary>();
    const todayStr = today.toISOString().slice(0, 10);
    for (const s of salaries) {
      if (s.effective_from > todayStr) continue;
      if (!map.has(s.profile_id)) map.set(s.profile_id, s);
    }
    return map;
  }, [salaries, today]);

  const visibleProfiles = profiles.filter((p) => p.is_active);

  const generate = useMutation({
    mutationFn: async () => {
      const [y, m] = selectedMonth.split('-').map(Number);
      const r = await fetch('/api/finance/payroll/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year: y, month: m })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      return (await r.json()) as { created: number; skipped: Array<{ reason: string }> };
    },
    onSuccess: (d) => {
      toast.success(t('generated', { count: d.created }));
      qc.invalidateQueries({ queryKey: ['finance-payroll'] });
      // Slide the range to the generated month so the user sees the rows.
      setRangeFrom(bounds.start);
      setRangeTo(bounds.end);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const delEntry = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/payroll/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('entry.deleted'));
      qc.invalidateQueries({ queryKey: ['finance-payroll'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const delSalary = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/finance/salaries/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('salary.deleted'));
      qc.invalidateQueries({ queryKey: ['finance-salaries'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingSalary(null);
              setSalaryModalOpen(true);
            }}
          >
            <DollarSign className="h-4 w-4" /> {t('salary.new')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditingEntry(null);
              setEntryModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t('entry.new')}
          </Button>
        </div>
      </div>

      {/* Current salaries */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> {t('salary.currentTitle')}
        </h2>
        <div className="grid gap-2">
          {visibleProfiles.length === 0 && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                {t('noProfiles')}
              </CardContent>
            </Card>
          )}
          {visibleProfiles.map((p) => {
            const sal = activeSalary.get(p.id);
            return (
              <Card key={p.id}>
                <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.role === 'admin' ? t('role.admin') : t('role.sitter')}
                      {sal ? ` · ${t('salary.since', { date: sal.effective_from })}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {sal ? (
                        <div className="text-sm font-medium">
                          {formatMoney(sal.monthly_salary)} {sal.currency}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">{t('salary.notSet')}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSalary({
                          id: '',
                          profile_id: p.id,
                          monthly_salary: sal?.monthly_salary ?? 0,
                          currency: sal?.currency ?? defaultCurrency,
                          effective_from: new Date().toISOString().slice(0, 10),
                          notes: null,
                          created_by: null,
                          created_at: '',
                          updated_at: ''
                        });
                        setSalaryModalOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" /> {tc('edit')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {salaries.length > 0 && (
          <details className="rounded-md border bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-medium">
              {t('salary.historyTitle')} ({salaries.length})
            </summary>
            <div className="mt-2 grid gap-1">
              {salaries.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-sm bg-background px-2 py-1 text-xs"
                >
                  <span className="min-w-0 truncate">
                    {s.profile?.full_name ?? '—'} · {s.effective_from} ·{' '}
                    {formatMoney(s.monthly_salary)} {s.currency}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(t('salary.confirmDelete'))) delSalary.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Period + generate */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('generate.period')}</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                const b = periodBoundsFor(e.target.value);
                setRangeFrom(b.start);
                setRangeTo(b.end);
              }}
            />
          </div>
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            <Sparkles className="h-4 w-4" />{' '}
            {generate.isPending ? tc('saving') : t('generate.run')}
          </Button>
          <div className="mx-2 h-8 w-px bg-border" />
          <div className="space-y-1">
            <Label className="text-xs">{tc('from')}</Label>
            <Input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tc('to')}</Label>
            <Input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Entries list */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('entry.title')}</h2>
          <Badge variant="secondary">{entries.length}</Badge>
        </div>
        {isLoading && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
        )}
        {!isLoading && entries.length === 0 && (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">{t('entry.empty')}</CardContent></Card>
        )}
        <div className="grid gap-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.profile?.full_name ?? '—'}</span>
                      <StatusBadge status={e.status} />
                      {e.transfer_proof_url && (
                        <Badge variant="secondary" className="gap-1">
                          <Paperclip className="h-3 w-3" /> {t('entry.proofAttached')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.period_start} → {e.period_end}
                      {e.payment_date ? ` · ${t('entry.paidOn', { date: e.payment_date })}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">
                      {formatMoney(e.net_amount)} {e.currency}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('entry.grossLabel')}: {formatMoney(e.gross_amount)} ·{' '}
                      {t('entry.bonusLabel')}: {formatMoney(e.bonus_amount)} ·{' '}
                      {t('entry.deductionLabel')}: {formatMoney(e.deduction_amount)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {e.status !== 'paid' && (
                    <Button size="sm" onClick={() => setPayEntry(e)}>
                      <CheckCircle2 className="h-4 w-4" /> {t('entry.markPaid')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingEntry(e);
                      setEntryModalOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(t('entry.confirmDelete'))) delEntry.mutate(e.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Modals */}
      <SalaryModal
        open={salaryModalOpen}
        onClose={() => {
          setSalaryModalOpen(false);
          setEditingSalary(null);
        }}
        profiles={visibleProfiles}
        defaultCurrency={defaultCurrency}
        salary={editingSalary ?? undefined}
      />
      <EntryModal
        open={entryModalOpen}
        onClose={() => {
          setEntryModalOpen(false);
          setEditingEntry(null);
        }}
        profiles={visibleProfiles}
        activeSalary={activeSalary}
        defaultCurrency={defaultCurrency}
        entry={editingEntry ?? undefined}
      />
      <PayModal
        open={!!payEntry}
        onClose={() => setPayEntry(null)}
        entry={payEntry}
      />
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Salary Modal ────────────────────────────────────────────────────────────
function SalaryModal({
  open,
  onClose,
  profiles,
  defaultCurrency,
  salary
}: {
  open: boolean;
  onClose: () => void;
  profiles: FinanceProfileLite[];
  defaultCurrency: string;
  salary?: ProfileSalary;
}) {
  const t = useTranslations('finance.payroll');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<ProfileSalaryInput>({
    resolver: zodResolver(profileSalarySchema),
    values: salary
      ? {
          profile_id: salary.profile_id,
          monthly_salary: Number(salary.monthly_salary),
          currency: salary.currency,
          effective_from: salary.effective_from || today,
          notes: salary.notes ?? ''
        }
      : undefined,
    defaultValues: salary
      ? undefined
      : {
          profile_id: profiles[0]?.id ?? '',
          monthly_salary: 0,
          currency: defaultCurrency,
          effective_from: today,
          notes: ''
        }
  });

  const m = useMutation({
    mutationFn: async (v: ProfileSalaryInput) => {
      const payload = { ...v, notes: v.notes || null };
      const r = await fetch('/api/finance/salaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('salary.saved'));
      qc.invalidateQueries({ queryKey: ['finance-salaries'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('salary.modalTitle')}>
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
        <Field label={t('salary.fields.profile')} error={errors.profile_id?.message}>
          <Select
            value={form.watch('profile_id')}
            onValueChange={(v) => form.setValue('profile_id', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('salary.fields.amount')} error={errors.monthly_salary?.message}>
            <Input type="number" step="0.01" min="0" {...form.register('monthly_salary')} />
          </Field>
          <Field label={t('salary.fields.currency')} error={errors.currency?.message}>
            <Input maxLength={3} {...form.register('currency')} />
          </Field>
        </div>
        <Field label={t('salary.fields.effectiveFrom')} error={errors.effective_from?.message}>
          <Input type="date" {...form.register('effective_from')} />
        </Field>
        <Field label={t('salary.fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : tc('save')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

// ─── Entry Modal ─────────────────────────────────────────────────────────────
function EntryModal({
  open,
  onClose,
  profiles,
  activeSalary,
  defaultCurrency,
  entry
}: {
  open: boolean;
  onClose: () => void;
  profiles: FinanceProfileLite[];
  activeSalary: Map<string, ProfileSalary>;
  defaultCurrency: string;
  entry?: PayrollEntry;
}) {
  const t = useTranslations('finance.payroll');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!entry?.id;
  const today = new Date();
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

  const form = useForm<PayrollEntryInput>({
    resolver: zodResolver(payrollEntrySchema),
    values: entry
      ? {
          profile_id: entry.profile_id,
          period_start: entry.period_start,
          period_end: entry.period_end,
          gross_amount: Number(entry.gross_amount),
          bonus_amount: Number(entry.bonus_amount),
          deduction_amount: Number(entry.deduction_amount),
          net_amount: Number(entry.net_amount),
          currency: entry.currency,
          status: entry.status,
          payment_date: entry.payment_date ?? null,
          payment_method: entry.payment_method,
          transfer_proof_url: entry.transfer_proof_url ?? '',
          transfer_proof_path: entry.transfer_proof_path ?? '',
          reference_number: entry.reference_number ?? '',
          notes: entry.notes ?? ''
        }
      : undefined,
    defaultValues: entry
      ? undefined
      : {
          profile_id: profiles[0]?.id ?? '',
          period_start: first.toISOString().slice(0, 10),
          period_end: last.toISOString().slice(0, 10),
          gross_amount: 0,
          bonus_amount: 0,
          deduction_amount: 0,
          currency: defaultCurrency,
          status: 'pending',
          payment_date: null,
          payment_method: null,
          transfer_proof_url: '',
          transfer_proof_path: '',
          reference_number: '',
          notes: ''
        }
  });

  const profileId = form.watch('profile_id');
  const gross = Number(form.watch('gross_amount') ?? 0);
  const bonus = Number(form.watch('bonus_amount') ?? 0);
  const deduction = Number(form.watch('deduction_amount') ?? 0);
  const computedNet = Number((gross + bonus - deduction).toFixed(2));

  const sal = profileId ? activeSalary.get(profileId) : undefined;

  const m = useMutation({
    mutationFn: async (v: PayrollEntryInput) => {
      const payload = {
        ...v,
        net_amount: computedNet,
        notes: v.notes || null,
        reference_number: v.reference_number || null,
        transfer_proof_url: v.transfer_proof_url || null,
        transfer_proof_path: v.transfer_proof_path || null,
        payment_date: v.payment_date || null,
        payment_method: v.payment_method || null
      };
      const r = await fetch(
        isEdit ? `/api/finance/payroll/${entry!.id}` : '/api/finance/payroll',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('entry.updated') : t('entry.created'));
      qc.invalidateQueries({ queryKey: ['finance-payroll'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  function fillFromSalary() {
    if (!sal) return;
    form.setValue('gross_amount', Number(sal.monthly_salary));
    form.setValue('currency', sal.currency);
  }

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? t('entry.edit') : t('entry.new')}
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
        <Field label={t('entry.fields.profile')} error={errors.profile_id?.message}>
          <Select
            value={form.watch('profile_id')}
            onValueChange={(v) => form.setValue('profile_id', v)}
            disabled={isEdit}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {sal && !isEdit && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-2 text-xs">
            <span>
              {t('entry.salaryHint', {
                amount: formatMoney(sal.monthly_salary),
                currency: sal.currency
              })}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={fillFromSalary}>
              {t('entry.useSalary')}
            </Button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('entry.fields.periodStart')} error={errors.period_start?.message}>
            <Input type="date" {...form.register('period_start')} />
          </Field>
          <Field label={t('entry.fields.periodEnd')} error={errors.period_end?.message}>
            <Input type="date" {...form.register('period_end')} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('entry.fields.gross')} error={errors.gross_amount?.message}>
            <Input type="number" step="0.01" min="0" {...form.register('gross_amount')} />
          </Field>
          <Field label={t('entry.fields.bonus')}>
            <Input type="number" step="0.01" min="0" {...form.register('bonus_amount')} />
          </Field>
          <Field label={t('entry.fields.deduction')}>
            <Input type="number" step="0.01" min="0" {...form.register('deduction_amount')} />
          </Field>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">{t('entry.netPreview')}</span>
          <span className="text-base font-semibold">
            {formatMoney(computedNet)} {form.watch('currency')}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('entry.fields.currency')} error={errors.currency?.message}>
            <Input maxLength={3} {...form.register('currency')} />
          </Field>
          <Field label={t('entry.fields.status')}>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as PayrollStatus)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYROLL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('entry.fields.paymentDate')} error={errors.payment_date?.message}>
            <Input
              type="date"
              value={form.watch('payment_date') ?? ''}
              onChange={(e) => form.setValue('payment_date', e.target.value || null)}
            />
          </Field>
          <Field label={t('entry.fields.paymentMethod')}>
            <Select
              value={form.watch('payment_method') ?? ''}
              onValueChange={(v) =>
                form.setValue('payment_method', (v || null) as PaymentMethod | null)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('entry.fields.noMethod')} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((mm) => (
                  <SelectItem key={mm} value={mm}>{t(`method.${mm}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t('entry.fields.reference')}>
          <Input {...form.register('reference_number')} />
        </Field>
        <Field label={t('entry.fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>
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

// ─── Mark-paid Modal (single-click flow with proof upload) ───────────────────
function PayModal({
  open,
  onClose,
  entry
}: {
  open: boolean;
  onClose: () => void;
  entry: PayrollEntry | null;
}) {
  const t = useTranslations('finance.payroll');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState<PaymentMethod | ''>('bank_transfer');
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error('No entry selected');
      let transfer_proof_url: string | null = null;
      let transfer_proof_path: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'payroll');
        fd.append('key', entry.id);
        const up = await fetch('/api/finance/attachments', { method: 'POST', body: fd });
        if (!up.ok) throw new Error((await up.json()).error ?? 'Upload failed');
        const data = (await up.json()) as { url: string | null; path: string };
        transfer_proof_url = data.url;
        transfer_proof_path = data.path;
      }
      const r = await fetch(`/api/finance/payroll/${entry.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          payment_date: paymentDate,
          payment_method: method || null,
          reference_number: reference || null,
          transfer_proof_url,
          transfer_proof_path
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('entry.paidSuccess'));
      qc.invalidateQueries({ queryKey: ['finance-payroll'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  if (!entry) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('entry.payModalTitle')}>
      <div className="space-y-3 py-2">
        <div className="rounded-md border bg-muted/40 p-2 text-sm">
          <div className="font-medium">{entry.profile?.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {entry.period_start} → {entry.period_end} · {formatMoney(entry.net_amount)} {entry.currency}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('entry.fields.paymentDate')}>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </Field>
          <Field label={t('entry.fields.paymentMethod')}>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod | '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{t(`method.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t('entry.fields.reference')}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={t('entry.fields.proof')}>
          <Input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <CheckCircle2 className="h-4 w-4" />{' '}
            {m.isPending ? tc('saving') : t('entry.confirmPaid')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
