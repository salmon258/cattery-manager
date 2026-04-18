'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Package, AlertTriangle, Clock, PackagePlus, MapPin,
  ClipboardList, ChevronRight, Boxes, Search
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { StockCheckoutModal } from './stock-checkout-modal';
import type {
  StockCategory, StockItemStatus, StockExpiringBatch
} from './stock-types';
import { STOCK_CATEGORIES } from './stock-types';

interface Props {
  isAdmin: boolean;
}

async function fetchStatus(): Promise<StockItemStatus[]> {
  const r = await fetch('/api/stock/status', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load stock');
  return (await r.json()).status;
}

async function fetchExpiring(): Promise<StockExpiringBatch[]> {
  const r = await fetch('/api/stock/expiring?days=30', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to load expiring batches');
  return (await r.json()).batches;
}

export function StockOverviewClient({ isAdmin }: Props) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [preselectItemId, setPreselectItemId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<StockCategory | 'all'>('all');
  const [onlyLow, setOnlyLow] = useState(false);

  const { data: status = [], isLoading } = useQuery({
    queryKey: ['stock-status'],
    queryFn: fetchStatus
  });
  const { data: expiring = [] } = useQuery({
    queryKey: ['stock-expiring'],
    queryFn: fetchExpiring
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return status.filter((row) => {
      if (onlyLow && !row.is_low_stock) return false;
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      if (q) {
        const hay = `${row.name} ${row.brand ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [status, search, categoryFilter, onlyLow]);

  const lowCount = status.filter((s) => s.is_low_stock && s.qty_on_hand >= 0).length;
  const expiringSoon = expiring.filter((b) => b.days_to_expiry <= 14).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            onClick={() => {
              setPreselectItemId(null);
              setCheckoutOpen(true);
            }}
          >
            <ClipboardList className="h-4 w-4" /> {t('checkout.cta')}
          </Button>
          {isAdmin && (
            <>
              <Button asChild variant="outline">
                <Link href="/stock/items"><Boxes className="h-4 w-4" /> {t('items.manage')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/stock/locations"><MapPin className="h-4 w-4" /> {t('locations.manage')}</Link>
              </Button>
              <Button asChild>
                <Link href="/stock/items?new=1"><PackagePlus className="h-4 w-4" /> {t('items.new')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alerts row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{t('alerts.lowStock')}</div>
                <div className="text-xs text-muted-foreground">{t('alerts.lowStockHint')}</div>
              </div>
            </div>
            <Badge variant={lowCount > 0 ? 'destructive' : 'secondary'}>{lowCount}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{t('alerts.expiring14')}</div>
                <div className="text-xs text-muted-foreground">{t('alerts.expiringHint')}</div>
              </div>
            </div>
            <Badge variant={expiringSoon > 0 ? 'destructive' : 'secondary'}>{expiringSoon}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as StockCategory | 'all')}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {STOCK_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{t(`categories.${c}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={onlyLow ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyLow((v) => !v)}
        >
          {onlyLow ? t('filters.lowOnlyOn') : t('filters.lowOnlyOff')}
        </Button>
      </div>

      {/* Items list */}
      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {!isLoading && filtered.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('empty')}</CardContent></Card>
      )}
      <div className="grid gap-3">
        {filtered.map((row) => (
          <Card key={row.stock_item_id} className="overflow-hidden">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/stock/${row.stock_item_id}`}
                className="flex min-w-0 flex-1 items-center gap-3 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate group-hover:underline">{row.name}</span>
                    {row.brand && <span className="text-xs text-muted-foreground">· {row.brand}</span>}
                    <Badge variant="secondary">{t(`categories.${row.category}`)}</Badge>
                    {row.is_low_stock && (
                      <Badge variant="destructive">{t('flags.low')}</Badge>
                    )}
                    {row.earliest_expiry && daysBetween(row.earliest_expiry) <= 14 && (
                      <Badge variant="destructive">
                        {t('flags.expiringInDays', { n: Math.max(daysBetween(row.earliest_expiry), 0) })}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatQty(row.qty_on_hand)} {t(`units.${row.unit}`)} · {row.active_batches} {t('batches', { count: row.active_batches })}
                    {row.earliest_expiry && (
                      <> · {t('earliestExpiry')} {row.earliest_expiry}</>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPreselectItemId(row.stock_item_id);
                    setCheckoutOpen(true);
                  }}
                  disabled={row.qty_on_hand <= 0}
                >
                  {t('checkout.takeSome')}
                </Button>
                <Button size="icon" variant="ghost" asChild>
                  <Link href={`/stock/${row.stock_item_id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <StockCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        presetItemId={preselectItemId}
      />
    </div>
  );
}

function daysBetween(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
function formatQty(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}
