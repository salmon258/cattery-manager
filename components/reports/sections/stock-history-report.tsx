'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';

import { ReportShell, type DateRange } from '../report-shell';
import { downloadCsv, toCsv } from '@/lib/export/csv';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  StockLocation, StockMovement, StockMovementType
} from '@/components/stock/stock-types';
import { STOCK_MOVEMENT_TYPES } from '@/components/stock/stock-types';

const TYPE_FILTER_VALUES = ['all', ...STOCK_MOVEMENT_TYPES] as const;

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function StockHistoryReport() {
  const t = useTranslations('stock');
  const tr = useTranslations('reports.stockHistory');
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [type, setType] = useState<StockMovementType | 'all'>('all');
  const [locationId, setLocationId] = useState<string>('all');

  const movementsQs = useMemo(() => {
    const qs = new URLSearchParams();
    if (type !== 'all') qs.set('type', type);
    if (locationId !== 'all') qs.set('location_id', locationId);
    qs.set('since', new Date(range.from).toISOString());
    qs.set('limit', '500');
    return qs.toString();
  }, [type, locationId, range.from]);

  const { data: rawMovements = [], isLoading } = useQuery({
    queryKey: ['report-stock-history', type, locationId, range.from],
    queryFn: async (): Promise<StockMovement[]> => {
      const r = await fetch(`/api/stock/movements?${movementsQs}`, { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).movements;
    }
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['stock-locations'],
    queryFn: async (): Promise<StockLocation[]> => {
      const r = await fetch('/api/stock/locations', { cache: 'no-store' });
      if (!r.ok) return [];
      return (await r.json()).locations;
    }
  });
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // Apply the report's "to" date client-side (the API only supports `since`).
  const movements = useMemo(() => {
    const toMs = new Date(`${range.to}T23:59:59.999Z`).getTime();
    return rawMovements.filter((m) => new Date(m.moved_at).getTime() <= toMs);
  }, [rawMovements, range.to]);

  // Aggregates by movement type for the summary header.
  const byType = useMemo(() => {
    const map = new Map<StockMovementType, { count: number; totalDelta: number }>();
    for (const m of movements) {
      const cur = map.get(m.type) ?? { count: 0, totalDelta: 0 };
      cur.count += 1;
      cur.totalDelta += Number(m.qty_delta) || 0;
      map.set(m.type, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [movements]);

  function exportCsv() {
    const flat = movements.map((m) => ({
      moved_at: new Date(m.moved_at).toISOString(),
      type: m.type,
      item: m.batch?.item?.name ?? '',
      brand: m.batch?.item?.brand ?? '',
      qty_delta: m.qty_delta,
      unit: m.batch?.item?.unit ?? '',
      from_location: m.from_location_id ? locMap.get(m.from_location_id)?.name ?? '' : '',
      to_location: m.to_location_id ? locMap.get(m.to_location_id)?.name ?? '' : '',
      for_cat: m.for_cat?.name ?? '',
      moved_by: m.moved_by_profile?.full_name ?? '',
      reason: m.reason ?? ''
    }));
    const csv = toCsv(flat, [
      { key: 'moved_at',      header: 'When' },
      { key: 'type',          header: 'Type' },
      { key: 'item',          header: 'Item' },
      { key: 'brand',         header: 'Brand' },
      { key: 'qty_delta',     header: 'Qty change' },
      { key: 'unit',          header: 'Unit' },
      { key: 'from_location', header: 'From' },
      { key: 'to_location',   header: 'To' },
      { key: 'for_cat',       header: 'For cat' },
      { key: 'moved_by',      header: 'By' },
      { key: 'reason',        header: 'Reason' }
    ]);
    downloadCsv(`stock-history-${range.from}-to-${range.to}`, csv);
  }

  return (
    <ReportShell
      title={tr('title')}
      description={tr('subtitle')}
      defaultRange={range}
      onRangeChange={setRange}
      onExport={exportCsv}
      exportDisabled={movements.length === 0}
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-xs font-medium text-muted-foreground">
              {t('movements.filters.type')}
            </span>
            <Select value={type} onValueChange={(v) => setType(v as StockMovementType | 'all')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('allTypes')}</SelectItem>
                {STOCK_MOVEMENT_TYPES.map((m) => (
                  <SelectItem key={m} value={m}>{t(`movementTypes.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-xs font-medium text-muted-foreground">
              {t('movements.filters.location')}
            </span>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('allLocations')}</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary by type */}
        {byType.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byType.map(([mType, agg]) => (
              <Card key={mType}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{t(`movementTypes.${mType}`)}</div>
                    <div className="text-lg font-semibold">{agg.count}</div>
                  </div>
                  <div className={
                    agg.totalDelta < 0 ? 'text-rose-600 text-sm font-medium' :
                    agg.totalDelta > 0 ? 'text-emerald-600 text-sm font-medium' :
                    'text-muted-foreground text-sm'
                  }>
                    {agg.totalDelta > 0 ? '+' : ''}{formatQty(agg.totalDelta)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Movement list */}
        {isLoading && (
          <p className="text-sm text-muted-foreground">{tr('loading')}</p>
        )}
        {!isLoading && movements.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              {tr('empty')}
            </CardContent>
          </Card>
        )}
        <div className="grid gap-2">
          {movements.map((m) => {
            const fromLoc = m.from_location_id ? locMap.get(m.from_location_id)?.name : null;
            const toLoc = m.to_location_id ? locMap.get(m.to_location_id)?.name : null;
            const itemName = m.batch?.item?.name ?? '—';
            const unit = m.batch?.item?.unit ? t(`units.${m.batch.item.unit}`) : '';
            return (
              <Card key={m.id}>
                <CardContent className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline">{t(`movementTypes.${m.type}`)}</Badge>
                      <span className="font-medium">{itemName}</span>
                      <span className={
                        m.qty_delta < 0 ? 'text-rose-600' :
                        m.qty_delta > 0 ? 'text-emerald-600' :
                        'text-muted-foreground'
                      }>
                        {m.qty_delta > 0 ? '+' : ''}{m.qty_delta} {unit}
                      </span>
                      {m.for_cat && (
                        <span className="text-xs text-muted-foreground">· {m.for_cat.name}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.moved_at).toLocaleString()}
                    </span>
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
          })}
        </div>
      </div>
    </ReportShell>
  );
}

function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
