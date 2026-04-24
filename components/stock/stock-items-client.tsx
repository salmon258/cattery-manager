'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Edit, Package, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { stockItemSchema, type StockItemInput } from '@/lib/schemas/stock';
import { STOCK_CATEGORIES, STOCK_UNITS, type StockItem, type StockLocation } from './stock-types';

async function fetchItems(includeInactive: boolean): Promise<StockItem[]> {
  const qs = includeInactive ? '?include_inactive=1' : '';
  const r = await fetch(`/api/stock/items${qs}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).items;
}

async function fetchLocations(): Promise<StockLocation[]> {
  const r = await fetch('/api/stock/locations', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).locations;
}

interface StockItemsClientProps {
  isAdmin: boolean;
}

export function StockItemsClient({ isAdmin }: StockItemsClientProps) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const params = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Auto-open "new" sheet via ?new=1 from the overview CTA
  useEffect(() => {
    if (params?.get('new') === '1') setCreateOpen(true);
  }, [params]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-items-admin', showInactive],
    queryFn: () => fetchItems(showInactive)
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: fetchLocations
  });

  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/stock/items/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('items.deactivated'));
      qc.invalidateQueries({ queryKey: ['stock-items-admin'] });
      qc.invalidateQueries({ queryKey: ['stock-status'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t('items.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('items.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? t('showActive') : t('showInactive')}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('items.new')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {!isLoading && items.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('items.empty')}</CardContent></Card>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <Link href={`/stock/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {item.name}
                    {item.brand && <span className="text-xs text-muted-foreground">· {item.brand}</span>}
                    <Badge variant="secondary">{t(`categories.${item.category}`)}</Badge>
                    {!item.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t(`units.${item.unit}`)} · {t('items.minThreshold')}: {formatNum(item.min_threshold)}
                    {item.default_location_id && locMap.get(item.default_location_id) && (
                      <> · {locMap.get(item.default_location_id)}</>
                    )}
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                    <Edit className="h-4 w-4" /> {tc('edit')}
                  </Button>
                  {item.is_active && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { if (confirm(t('items.deactivateConfirm'))) del.mutate(item.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <StockItemModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        locations={locations}
      />
      <StockItemModal
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editing ?? undefined}
        locations={locations}
      />
    </div>
  );
}

function StockItemModal({
  open,
  onClose,
  item,
  locations
}: {
  open: boolean;
  onClose: () => void;
  item?: StockItem;
  locations: StockLocation[];
}) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!item;

  const form = useForm<StockItemInput>({
    resolver: zodResolver(stockItemSchema),
    values: item
      ? {
          name: item.name,
          brand: item.brand ?? '',
          category: item.category,
          unit: item.unit,
          min_threshold: item.min_threshold,
          default_location_id: item.default_location_id,
          photo_url: item.photo_url ?? '',
          notes: item.notes ?? '',
          is_active: item.is_active
        }
      : undefined,
    defaultValues: item
      ? undefined
      : {
          name: '', brand: '', category: 'other', unit: 'pcs',
          min_threshold: 0, default_location_id: null,
          photo_url: '', notes: '', is_active: true
        }
  });

  const m = useMutation({
    mutationFn: async (v: StockItemInput) => {
      const payload = {
        ...v,
        brand: v.brand || null,
        photo_url: v.photo_url || null,
        notes: v.notes || null,
        default_location_id: v.default_location_id || null
      };
      const r = await fetch(isEdit ? `/api/stock/items/${item!.id}` : '/api/stock/items', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('items.updated') : t('items.created'));
      qc.invalidateQueries({ queryKey: ['stock-items-admin'] });
      qc.invalidateQueries({ queryKey: ['stock-status'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={isEdit ? tc('edit') : t('items.new')}>
      <form
        onSubmit={form.handleSubmit(
          (v) => m.mutate(v),
          (errs) => {
            // Surface the first error so the user isn't left clicking a
            // dead button when validation fails on a field that isn't rendered.
            const first = Object.values(errs)[0];
            const msg = (first && (first as { message?: string }).message) || 'Invalid input';
            toast.error(msg);
          }
        )}
        className="space-y-3 py-2"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('items.fields.name')} error={errors.name?.message}>
            <Input {...form.register('name')} />
          </Field>
          <Field label={t('items.fields.brand')}>
            <Input {...form.register('brand')} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('items.fields.category')}>
            <Select
              value={form.watch('category') ?? 'other'}
              onValueChange={(v) => form.setValue('category', v as StockItemInput['category'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOCK_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{t(`categories.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('items.fields.unit')}>
            <Select
              value={form.watch('unit') ?? 'pcs'}
              onValueChange={(v) => form.setValue('unit', v as StockItemInput['unit'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOCK_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{t(`units.${u}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('items.fields.minThreshold')} error={errors.min_threshold?.message}>
            <Input type="number" step="0.01" min="0" {...form.register('min_threshold')} />
          </Field>
          <Field label={t('items.fields.defaultLocation')}>
            <Select
              value={form.watch('default_location_id') ?? ''}
              onValueChange={(v) => form.setValue('default_location_id', v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('items.fields.noLocation')} />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t('items.fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            {t('items.fields.active')}
          </label>
        )}
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

function formatNum(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
