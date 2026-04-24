'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeftRight, ArrowLeft, ChevronLeft, Edit, PackagePlus,
  ClipboardList, Package, Clock, Trash2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { StockCheckoutModal } from './stock-checkout-modal';
import type { StockBatch, StockItem, StockLocation, StockMovement } from './stock-types';

interface Props { itemId: string; isAdmin: boolean }

export function StockItemDetailClient({ itemId, isAdmin }: Props) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [stockInOpen, setStockInOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [transferBatch, setTransferBatch] = useState<StockBatch | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<StockBatch | null>(null);

  const { data } = useQuery({
    queryKey: ['stock-item-detail', itemId],
    queryFn: async (): Promise<{ item: StockItem; batches: StockBatch[] }> => {
      const r = await fetch(`/api/stock/items/${itemId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    }
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: async (): Promise<StockLocation[]> => {
      const r = await fetch('/api/stock/locations', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).locations;
    }
  });
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const { data: movements = [] } = useQuery({
    queryKey: ['stock-movements', itemId],
    queryFn: async (): Promise<StockMovement[]> => {
      const r = await fetch(`/api/stock/movements?stock_item_id=${itemId}&limit=50`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).movements;
    }
  });

  if (!data) {
    return <div className="text-sm text-muted-foreground">{tc('loading')}</div>;
  }

  const item = data.item;
  const batches = data.batches;
  const totalRemaining = batches.reduce((s, b) => s + Number(b.qty_remaining), 0);
  const activeBatches = batches.filter((b) => Number(b.qty_remaining) > 0);

  // Sort batches: active (earliest expiry first) then depleted
  const sortedBatches = [...batches].sort((a, b) => {
    const aActive = a.qty_remaining > 0 ? 0 : 1;
    const bActive = b.qty_remaining > 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (a.expiry_date && b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
    if (a.expiry_date) return -1;
    if (b.expiry_date) return 1;
    return b.received_at.localeCompare(a.received_at);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/stock"><ChevronLeft className="h-4 w-4" /> {t('backToOverview')}</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                <Package className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold truncate">{item.name}</h1>
                  {item.brand && <span className="text-sm text-muted-foreground">· {item.brand}</span>}
                  <Badge variant="secondary">{t(`categories.${item.category}`)}</Badge>
                  {!item.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('onHand')}: <span className="font-medium text-foreground">{formatQty(totalRemaining)} {t(`units.${item.unit}`)}</span>
                  {' · '}{activeBatches.length} {t('batches', { count: activeBatches.length })}
                  {' · '}{t('items.minThreshold')}: {formatQty(item.min_threshold)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setCheckoutOpen(true)} disabled={totalRemaining <= 0}>
                <ClipboardList className="h-4 w-4" /> {t('checkout.cta')}
              </Button>
              <Button onClick={() => setStockInOpen(true)}>
                <PackagePlus className="h-4 w-4" /> {t('stockIn.cta')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('batches', { count: 2 })}</h2>
        {sortedBatches.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">{t('noBatches')}</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {sortedBatches.map((b) => {
              const days = b.expiry_date ? daysBetween(b.expiry_date) : null;
              const urgency = days == null ? 'none'
                : days < 0 ? 'expired'
                : days <= 14 ? 'red'
                : days <= 30 ? 'amber'
                : 'none';
              const location = b.location_id ? locMap.get(b.location_id) : null;
              const depleted = b.qty_remaining <= 0;
              return (
                <Card key={b.id} className={depleted ? 'opacity-60' : undefined}>
                  <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {formatQty(b.qty_remaining)} / {formatQty(b.qty_initial)} {t(`units.${item.unit}`)}
                        {depleted && <Badge variant="secondary">{t('depleted')}</Badge>}
                        {urgency === 'expired' && <Badge variant="destructive">{t('checkout.fields.expired')}</Badge>}
                        {urgency === 'red' && (
                          <Badge variant="destructive"><Clock className="mr-1 h-3 w-3" />{t('checkout.fields.daysLeft', { n: days ?? 0 })}</Badge>
                        )}
                        {urgency === 'amber' && (
                          <Badge className="bg-amber-500 text-white border-0 hover:bg-amber-500">
                            <Clock className="mr-1 h-3 w-3" />{t('checkout.fields.daysLeft', { n: days ?? 0 })}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        {b.expiry_date && <span>{t('checkout.fields.expiresOn')} {b.expiry_date}</span>}
                        {location && <span>{t('checkout.fields.location')}: {location.name}</span>}
                        {b.cost_per_unit != null && (
                          <span>{t('cost')}: {formatQty(b.cost_per_unit)} {b.currency ?? ''}</span>
                        )}
                        {b.batch_ref && <span>{t('checkout.fields.batchRef')}: {b.batch_ref}</span>}
                        <span>{t('receivedOn')} {b.received_at.slice(0, 10)}</span>
                      </div>
                    </div>
                    {isAdmin && !depleted && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setTransferBatch(b)}>
                          <ArrowLeftRight className="h-4 w-4" /> {t('transfer.cta')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAdjustBatch(b)}>
                          <Edit className="h-4 w-4" /> {t('adjust.cta')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('movements.title')}</h2>
        {movements.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">{t('movements.empty')}</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {movements.map((m) => (
              <MovementRow key={m.id} m={m} unitLabel={t(`units.${item.unit}`)} locMap={locMap} />
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <StockInModal
        open={stockInOpen}
        onClose={() => setStockInOpen(false)}
        itemId={itemId}
        defaultLocationId={item.default_location_id}
        locations={locations}
      />
      <StockCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        presetItemId={itemId}
      />
      <TransferModal
        batch={transferBatch}
        onClose={() => setTransferBatch(null)}
        locations={locations}
      />
      <AdjustModal
        batch={adjustBatch}
        onClose={() => setAdjustBatch(null)}
        unitLabel={t(`units.${item.unit}`)}
      />
    </div>
  );
}

function MovementRow({
  m, unitLabel, locMap
}: {
  m: StockMovement; unitLabel: string; locMap: Map<string, StockLocation>
}) {
  const t = useTranslations('stock');
  const fromLoc = m.from_location_id ? locMap.get(m.from_location_id)?.name : null;
  const toLoc = m.to_location_id ? locMap.get(m.to_location_id)?.name : null;
  return (
    <Card>
      <CardContent className="p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{t(`movementTypes.${m.type}`)}</Badge>
            <span className={m.qty_delta < 0 ? 'text-rose-600 font-medium' : m.qty_delta > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
              {m.qty_delta > 0 ? '+' : ''}{formatQty(m.qty_delta)} {unitLabel}
            </span>
            {m.for_cat && <span className="text-xs text-muted-foreground">· {m.for_cat.name}</span>}
          </div>
          <span className="text-xs text-muted-foreground">{formatDateTime(m.moved_at)}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
          {fromLoc && <span>{t('from')}: {fromLoc}</span>}
          {toLoc && <span>{t('to')}: {toLoc}</span>}
          {m.moved_by_profile && <span>{t('by')}: {m.moved_by_profile.full_name}</span>}
          {m.reason && <span>· {m.reason}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Stock-in modal --------------------------- */
function StockInModal({
  open, onClose, itemId, defaultLocationId, locations
}: {
  open: boolean; onClose: () => void; itemId: string;
  defaultLocationId: string | null; locations: StockLocation[];
}) {
  const t = useTranslations('stock.stockIn');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [expiry, setExpiry] = useState('');
  const [locationId, setLocationId] = useState<string | null>(defaultLocationId);
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('IDR');
  const [batchRef, setBatchRef] = useState('');
  const [notes, setNotes] = useState('');

  // Reset on open
  useMemoEffect(open, () => {
    setQty('');
    setExpiry('');
    setLocationId(defaultLocationId);
    setCost('');
    setBatchRef('');
    setNotes('');
  });

  const m = useMutation({
    mutationFn: async () => {
      const qtyNum = Number(qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) throw new Error(t('errors.qtyPositive'));
      const payload = {
        stock_item_id: itemId,
        qty: qtyNum,
        location_id: locationId || null,
        expiry_date: expiry || null,
        cost_per_unit: cost ? Number(cost) : null,
        currency: cost ? currency : null,
        batch_ref: batchRef || null,
        notes: notes || null
      };
      const r = await fetch('/api/stock/batches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['stock-item-detail'] });
      qc.invalidateQueries({ queryKey: ['stock-status'] });
      qc.invalidateQueries({ queryKey: ['stock-expiring'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      qc.invalidateQueries({ queryKey: ['finance-transactions'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('title')}>
      <div className="space-y-3 py-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('fields.qty')}</Label>
            <Input type="number" step="0.01" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('fields.location')}</Label>
            <Select value={locationId ?? ''} onValueChange={(v) => setLocationId(v || null)}>
              <SelectTrigger><SelectValue placeholder={t('fields.noLocation')} /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('fields.expiry')}</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('fields.batchRef')}</Label>
            <Input value={batchRef} onChange={(e) => setBatchRef(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('fields.costPerUnit')}</Label>
            <Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('fields.costHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('fields.currency')}</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{tc('notes')}</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="button" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? tc('saving') : tc('create')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

/* ----------------------------- Transfer modal --------------------------- */
function TransferModal({
  batch, onClose, locations
}: {
  batch: StockBatch | null; onClose: () => void; locations: StockLocation[];
}) {
  const t = useTranslations('stock.transfer');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [toLocId, setToLocId] = useState<string>('');
  const [reason, setReason] = useState('');

  useMemoEffect(!!batch, () => {
    setToLocId('');
    setReason('');
  });

  const others = locations.filter((l) => l.id !== batch?.location_id && l.is_active);

  const m = useMutation({
    mutationFn: async () => {
      if (!batch) return;
      if (!toLocId) throw new Error(t('errors.pickLocation'));
      const r = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.id,
          to_location_id: toLocId,
          reason: reason.trim() || null
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['stock-item-detail'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal open={!!batch} onOpenChange={(o) => !o && onClose()} title={t('title')}>
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>{t('fields.destination')}</Label>
          <Select value={toLocId} onValueChange={setToLocId}>
            <SelectTrigger><SelectValue placeholder={t('fields.destinationPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {others.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('fields.reason')}</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="button" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? tc('saving') : t('confirm')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

/* ------------------------------ Adjust modal --------------------------- */
function AdjustModal({
  batch, onClose, unitLabel
}: {
  batch: StockBatch | null; onClose: () => void; unitLabel: string;
}) {
  const t = useTranslations('stock.adjust');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  useMemoEffect(!!batch, () => {
    setDelta('');
    setReason('');
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!batch) return;
      const n = Number(delta);
      if (!Number.isFinite(n) || n === 0) throw new Error(t('errors.nonZero'));
      const r = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          batch_id: batch.id,
          qty_delta: n,
          reason: reason.trim() || null
        })
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['stock-item-detail'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['stock-status'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <ResponsiveModal open={!!batch} onOpenChange={(o) => !o && onClose()} title={t('title')}>
      <div className="space-y-3 py-2">
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <div className="space-y-2">
          <Label>{t('fields.delta', { unit: unitLabel })}</Label>
          <Input
            type="number"
            step="0.01"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="-5 or +3"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('fields.reason')}</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('fields.reasonPlaceholder')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="button" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? tc('saving') : t('confirm')}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

/* --------------------------------- utils -------------------------------- */

// Runs `fn` whenever `key` becomes true — used to reset modal form state.
function useMemoEffect(key: boolean, fn: () => void) {
  useEffect(() => {
    if (key) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function daysBetween(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}
function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : Number(n).toFixed(2);
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}
