'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle2, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { StockBatch, StockItem, StockLocation, StockItemStatus } from './stock-types';

interface Props {
  open: boolean;
  onClose: () => void;
  presetItemId?: string | null;
}

interface CatRow { id: string; name: string; status: string }

export function StockCheckoutModal({ open, onClose, presetItemId }: Props) {
  const t = useTranslations('stock.checkout');
  const tc = useTranslations('common');
  const tStock = useTranslations('stock');
  const qc = useQueryClient();

  const [itemId, setItemId] = useState<string | null>(presetItemId ?? null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [qty, setQty] = useState<string>('1');
  const [catId, setCatId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setItemId(presetItemId ?? null);
      setBatchId(null);
      setQty('1');
      setCatId(null);
      setReason('');
    }
  }, [open, presetItemId]);

  // Items for the picker — only those with on-hand > 0
  const { data: status = [] } = useQuery({
    queryKey: ['stock-status'],
    queryFn: async (): Promise<StockItemStatus[]> => {
      const r = await fetch('/api/stock/status', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).status;
    },
    enabled: open
  });

  const availableItems = useMemo(
    () => status.filter((s) => s.qty_on_hand > 0),
    [status]
  );

  const { data: itemDetail } = useQuery({
    queryKey: ['stock-item-detail', itemId],
    queryFn: async (): Promise<{ item: StockItem; batches: StockBatch[] }> => {
      const r = await fetch(`/api/stock/items/${itemId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    enabled: !!itemId && open
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: async (): Promise<StockLocation[]> => {
      const r = await fetch('/api/stock/locations', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).locations;
    },
    enabled: open
  });

  const { data: cats = [] } = useQuery({
    queryKey: ['cats-for-checkout'],
    queryFn: async (): Promise<CatRow[]> => {
      const r = await fetch('/api/cats', { cache: 'no-store' });
      if (!r.ok) return [];
      const j = await r.json();
      return (j.cats ?? j.items ?? []) as CatRow[];
    },
    enabled: open
  });

  const availableBatches = useMemo(() => {
    const list = (itemDetail?.batches ?? []).filter((b) => b.qty_remaining > 0);
    // Earliest expiry first (nulls last). This is the FIFO nudge.
    return [...list].sort((a, b) => {
      if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
      if (a.expiry_date) return -1;
      if (b.expiry_date) return 1;
      return a.received_at.localeCompare(b.received_at);
    });
  }, [itemDetail?.batches]);

  // Auto-select the suggested batch (first after sort) when item changes
  useEffect(() => {
    if (!batchId && availableBatches.length > 0) {
      setBatchId(availableBatches[0].id);
    }
  }, [availableBatches, batchId]);

  const selectedBatch = availableBatches.find((b) => b.id === batchId);
  const locMap = new Map(locations.map((l) => [l.id, l]));

  const m = useMutation({
    mutationFn: async () => {
      if (!batchId) throw new Error(t('errors.pickBatch'));
      const qtyNum = Number(qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new Error(t('errors.qtyPositive'));
      if (selectedBatch && qtyNum > selectedBatch.qty_remaining) {
        throw new Error(t('errors.qtyExceeds'));
      }
      const r = await fetch('/api/stock/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          qty: qtyNum,
          for_cat_id: catId || null,
          reason: reason.trim() || null
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['stock-status'] });
      qc.invalidateQueries({ queryKey: ['stock-expiring'] });
      qc.invalidateQueries({ queryKey: ['stock-item-detail'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('title')}>
      <div className="space-y-4 py-2">
        {/* Item picker */}
        <div className="space-y-2">
          <Label>{t('fields.item')}</Label>
          <Select
            value={itemId ?? ''}
            onValueChange={(v) => {
              setItemId(v || null);
              setBatchId(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('fields.itemPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {availableItems.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t('noItemsAvailable')}
                </div>
              )}
              {availableItems.map((s) => (
                <SelectItem key={s.stock_item_id} value={s.stock_item_id}>
                  {s.name}{s.brand ? ` · ${s.brand}` : ''} · {formatQty(s.qty_on_hand)} {tStock(`units.${s.unit}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Batch picker — only when item chosen */}
        {itemId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('fields.batch')}</Label>
              <span className="text-xs text-muted-foreground">{t('fields.batchHint')}</span>
            </div>
            {availableBatches.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {t('noBatches')}
              </div>
            ) : (
              <div className="space-y-2">
                {availableBatches.map((b, idx) => {
                  const selected = b.id === batchId;
                  const days = b.expiry_date ? daysBetween(b.expiry_date) : null;
                  const urgency = days == null ? 'none'
                    : days < 0 ? 'expired'
                    : days <= 14 ? 'red'
                    : days <= 30 ? 'amber'
                    : 'none';
                  const location = b.location_id ? locMap.get(b.location_id) : null;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBatchId(b.id)}
                      className={
                        'w-full text-left rounded-md border p-3 transition-colors ' +
                        (selected
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                          : 'hover:bg-accent')
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {selected && <CheckCircle2 className="h-4 w-4 text-violet-600" />}
                        <span className="font-medium">
                          {t('fields.batchLine', {
                            qty: formatQty(b.qty_remaining),
                            unit: itemDetail ? tStock(`units.${itemDetail.item.unit}`) : ''
                          })}
                        </span>
                        {idx === 0 && <Badge variant="secondary">{t('fields.suggested')}</Badge>}
                        {urgency === 'expired' && (
                          <Badge variant="destructive">{t('fields.expired')}</Badge>
                        )}
                        {urgency === 'red' && (
                          <Badge variant="destructive">
                            <Clock className="mr-1 h-3 w-3" />
                            {t('fields.daysLeft', { n: days ?? 0 })}
                          </Badge>
                        )}
                        {urgency === 'amber' && (
                          <Badge className="bg-amber-500 text-white border-0 hover:bg-amber-500">
                            <Clock className="mr-1 h-3 w-3" />
                            {t('fields.daysLeft', { n: days ?? 0 })}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        {b.expiry_date && <span>{t('fields.expiresOn')} {b.expiry_date}</span>}
                        {location && <span>{t('fields.location')}: {location.name}</span>}
                        {b.batch_ref && <span>{t('fields.batchRef')}: {b.batch_ref}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quantity */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('fields.qty')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            {selectedBatch && (
              <p className="text-xs text-muted-foreground">
                {t('fields.maxAvailable', {
                  qty: formatQty(selectedBatch.qty_remaining),
                  unit: itemDetail ? tStock(`units.${itemDetail.item.unit}`) : ''
                })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('fields.forCat')}</Label>
            <Select value={catId ?? ''} onValueChange={(v) => setCatId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder={t('fields.forCatPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('fields.reason')}</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="button" onClick={() => m.mutate()} disabled={m.isPending || !batchId}>
            {m.isPending ? tc('saving') : t('confirm')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function daysBetween(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}
function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
