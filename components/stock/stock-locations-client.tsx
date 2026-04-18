'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Edit, MapPin, Plus, Snowflake, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

import { stockLocationSchema, type StockLocationInput } from '@/lib/schemas/stock';
import type { StockLocation } from './stock-types';

async function fetchLocations(includeInactive: boolean): Promise<StockLocation[]> {
  const qs = includeInactive ? '?include_inactive=1' : '';
  const r = await fetch(`/api/stock/locations${qs}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).locations;
}

export function StockLocationsClient() {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['stock-locations-admin', showInactive],
    queryFn: () => fetchLocations(showInactive)
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/stock/locations/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('locations.deactivated'));
      qc.invalidateQueries({ queryKey: ['stock-locations-admin'] });
      qc.invalidateQueries({ queryKey: ['stock-locations'] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t('locations.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('locations.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? t('showActive') : t('showInactive')}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('locations.new')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {!isLoading && locations.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('locations.empty')}</CardContent></Card>
      )}

      <div className="grid gap-3">
        {locations.map((loc) => (
          <Card key={loc.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    {loc.name}
                    {loc.is_cold_storage && (
                      <Badge variant="secondary"><Snowflake className="mr-1 h-3 w-3" />{t('locations.cold')}</Badge>
                    )}
                    {!loc.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                  </div>
                  {loc.description && (
                    <div className="text-xs text-muted-foreground">{loc.description}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(loc)}>
                  <Edit className="h-4 w-4" /> {tc('edit')}
                </Button>
                {loc.is_active && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (confirm(t('locations.deactivateConfirm'))) del.mutate(loc.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <LocationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <LocationModal open={!!editing} onClose={() => setEditing(null)} location={editing ?? undefined} />
    </div>
  );
}

function LocationModal({
  open, onClose, location
}: {
  open: boolean; onClose: () => void; location?: StockLocation
}) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const isEdit = !!location;

  const form = useForm<StockLocationInput>({
    resolver: zodResolver(stockLocationSchema),
    values: location
      ? {
          name: location.name,
          description: location.description ?? '',
          is_cold_storage: location.is_cold_storage,
          is_active: location.is_active
        }
      : undefined,
    defaultValues: location ? undefined : {
      name: '', description: '', is_cold_storage: false, is_active: true
    }
  });

  const m = useMutation({
    mutationFn: async (v: StockLocationInput) => {
      const payload = { ...v, description: v.description || null };
      const r = await fetch(isEdit ? `/api/stock/locations/${location!.id}` : '/api/stock/locations', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('locations.updated') : t('locations.created'));
      qc.invalidateQueries({ queryKey: ['stock-locations-admin'] });
      qc.invalidateQueries({ queryKey: ['stock-locations'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={isEdit ? tc('edit') : t('locations.new')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>{t('locations.fields.name')}</Label>
          <Input {...form.register('name')} />
          {errors.name?.message && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>{t('locations.fields.description')}</Label>
          <Textarea rows={2} {...form.register('description')} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('is_cold_storage')} />
          {t('locations.fields.cold')}
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            {t('locations.fields.active')}
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
