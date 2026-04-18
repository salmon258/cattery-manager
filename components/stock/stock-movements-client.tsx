'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Filter, History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { StockLocation, StockMovement, StockMovementType } from './stock-types';
import { STOCK_MOVEMENT_TYPES } from './stock-types';

export function StockMovementsClient() {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const [type, setType] = useState<StockMovementType | 'all'>('all');
  const [locationId, setLocationId] = useState<string>('all');
  const [since, setSince] = useState<string>(''); // YYYY-MM-DD

  const qs = new URLSearchParams();
  if (type !== 'all') qs.set('type', type);
  if (locationId !== 'all') qs.set('location_id', locationId);
  if (since) qs.set('since', new Date(since).toISOString());
  qs.set('limit', '200');

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock-movements-ledger', type, locationId, since],
    queryFn: async (): Promise<StockMovement[]> => {
      const r = await fetch(`/api/stock/movements?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed');
      return (await r.json()).movements;
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
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/stock"><ChevronLeft className="h-4 w-4" /> {t('backToOverview')}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t('movements.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('movements.subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> {t('movements.filters.type')}
            </span>
            <Select value={type} onValueChange={(v) => setType(v as StockMovementType | 'all')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc('empty')}</SelectItem>
                {STOCK_MOVEMENT_TYPES.map((m) => (
                  <SelectItem key={m} value={m}>{t(`movementTypes.${m}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 min-w-[160px]">
            <span className="text-xs font-medium text-muted-foreground">{t('movements.filters.location')}</span>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc('empty')}</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t('movements.filters.since')}</span>
            <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {!isLoading && movements.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('movements.empty')}</CardContent></Card>
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
                    <Link
                      className="font-medium hover:underline"
                      href={m.batch ? `/stock/${m.batch.stock_item_id}` : '/stock'}
                    >
                      {itemName}
                    </Link>
                    <span className={m.qty_delta < 0 ? 'text-rose-600' : m.qty_delta > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                      {m.qty_delta > 0 ? '+' : ''}{m.qty_delta} {unit}
                    </span>
                    {m.for_cat && <span className="text-xs text-muted-foreground">· {m.for_cat.name}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(m.moved_at).toLocaleString()}</span>
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
  );
}
