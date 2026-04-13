'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Edit, Plus, Trash2, Utensils } from 'lucide-react';

import type { FoodItem, FoodType, FoodUnit } from '@/lib/supabase/aliases';
import { foodItemSchema, type FoodItemInput } from '@/lib/schemas/food';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const TYPES: FoodType[] = ['wet', 'dry', 'raw', 'treat', 'supplement', 'other'];
const UNITS: FoodUnit[] = ['g', 'ml', 'sachet', 'piece'];

async function fetchItems(includeInactive: boolean): Promise<FoodItem[]> {
  const qs = includeInactive ? '?include_inactive=1' : '';
  const r = await fetch(`/api/food-items${qs}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).items;
}

export function FoodItemsClient() {
  const t = useTranslations('food');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['food-items', showInactive],
    queryFn: () => fetchItems(showInactive)
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/food-items/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('deactivated'));
      qc.invalidateQueries({ queryKey: ['food-items'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? t('hideInactive') : t('showInactive')}
          </Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {t('new')}</Button>
        </div>
      </div>

      {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && items.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('empty')}</CardContent></Card>
      )}

      <div className="grid gap-3">
        {items.map((f) => (
          <Card key={f.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <Utensils className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {f.name}
                    {f.brand && <span className="text-xs text-muted-foreground">· {f.brand}</span>}
                    <Badge variant="secondary">{t(`types.${f.type}`)}</Badge>
                    {!f.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {f.calories_per_gram} kcal/g · {t(`units.${f.unit}`)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(f)}>
                  <Edit className="h-4 w-4" /> {tc('edit')}
                </Button>
                {f.is_active && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (confirm(t('deactivateConfirm'))) del.mutate(f.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FoodSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <FoodSheet open={!!editing} onClose={() => setEditing(null)} item={editing ?? undefined} />
    </div>
  );
}

/* ------------------------------ modal ------------------------------ */

function FoodSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item?: FoodItem }) {
  const t = useTranslations('food');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!item;

  const form = useForm<FoodItemInput>({
    resolver: zodResolver(foodItemSchema),
    values: item
      ? {
          name: item.name,
          brand: item.brand ?? '',
          type: item.type,
          calories_per_gram: item.calories_per_gram,
          unit: item.unit,
          notes: item.notes ?? '',
          is_active: item.is_active
        }
      : undefined,
    defaultValues: item
      ? undefined
      : { name: '', brand: '', type: 'dry', calories_per_gram: 3.5, unit: 'g', notes: '', is_active: true }
  });

  const m = useMutation({
    mutationFn: async (v: FoodItemInput) => {
      const r = await fetch(isEdit ? `/api/food-items/${item!.id}` : '/api/food-items', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('updated') : t('created'));
      qc.invalidateQueries({ queryKey: ['food-items'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={isEdit ? tc('edit') : t('new')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <Field label={t('fields.name')} error={errors.name?.message}>
          <Input {...form.register('name')} />
        </Field>
        <Field label={t('fields.brand')} error={errors.brand?.message}>
          <Input {...form.register('brand')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('fields.type')}>
            <Select value={form.watch('type') ?? 'dry'} onValueChange={(v) => form.setValue('type', v as FoodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => <SelectItem key={ty} value={ty}>{t(`types.${ty}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('fields.unit')}>
            <Select value={form.watch('unit') ?? 'g'} onValueChange={(v) => form.setValue('unit', v as FoodUnit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{t(`units.${u}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label={t('fields.caloriesPerGram')} error={errors.calories_per_gram?.message}>
          <Input type="number" step="0.01" min="0" max="20" {...form.register('calories_per_gram')} />
        </Field>
        <Field label={t('fields.notes')}>
          <Textarea rows={2} {...form.register('notes')} />
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            {t('fields.active')}
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
