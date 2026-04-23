'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catDetailQueryOptions } from '@/lib/queries/cats';
import { useTranslations } from 'next-intl';
import { Pill, Plus, Search, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Cat, UserRole } from '@/lib/supabase/aliases';
import { Home, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { BatchAssignModal } from '@/components/assignees/batch-assign-modal';
import { BatchMedicationModal } from '@/components/medications/batch-medication-modal';

type CatRow = Cat & {
  current_room?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string } | null;
};

async function fetchCats(q: string): Promise<CatRow[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const r = await fetch(`/api/cats?${params.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).cats;
}

export function CatsClient({ role }: { role: UserRole }) {
  const t = useTranslations('cats');
  const tc = useTranslations('common');
  const ts = useTranslations('cats.status');
  const ta = useTranslations('assignees');
  const tm = useTranslations('medications');
  const [q, setQ] = useState('');
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchMedModalOpen, setBatchMedModalOpen] = useState(false);
  const isAdmin = role === 'admin';

  const qc = useQueryClient();

  const { data: cats = [], isLoading, error, refetch } = useQuery({
    queryKey: ['cats', q],
    queryFn: () => fetchCats(q)
  });

  // Warm the cat-detail cache when the user hovers / focuses a row. Next's
  // <Link prefetch> already grabs the route chunks; this grabs the actual
  // data. If the user taps the card within ~150ms, the detail page renders
  // instantly without a loading flash. Deduped by React Query — repeat
  // hovers on the same row are cheap.
  const prefetchCatDetail = (id: string) => {
    qc.prefetchQuery(catDetailQueryOptions(id));
  };

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function enterSelectMode() {
    setSelectMode(true);
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function selectAll() {
    setSelectedIds(new Set(cats.map((c) => c.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && !selectMode && (
            <Button variant="outline" onClick={enterSelectMode}>
              <UserPlus className="h-4 w-4" /> {ta('batchAssign')}
            </Button>
          )}
          {isAdmin && selectMode && (
            <>
              <span className="text-sm text-muted-foreground">
                {ta('selectedCount', { count: selectedIds.size })}
              </span>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {ta('selectAll')}
              </Button>
              <Button
                disabled={selectedIds.size === 0}
                onClick={() => setBatchModalOpen(true)}
              >
                <UserPlus className="h-4 w-4" /> {ta('assignSelected')}
              </Button>
              <Button
                variant="outline"
                disabled={selectedIds.size === 0}
                onClick={() => setBatchMedModalOpen(true)}
              >
                <Pill className="h-4 w-4" /> {tm('batchSchedule')}
              </Button>
              <Button variant="outline" size="icon" onClick={exitSelectMode} aria-label={tc('cancel')}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {role === 'admin' && !selectMode && (
            <Button asChild><Link href="/cats/new"><Plus className="h-4 w-4" /> {t('new')}</Link></Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tc('search')}
          className="pl-9"
        />
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

      {!isLoading && !error && cats.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('list.empty')}</CardContent></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => {
          const selected = selectedIds.has(c.id);
          const cardInner = (
            <Card className={
              'hover:bg-accent/40 transition-colors ' +
              (selectMode && selected ? 'ring-2 ring-primary' : '')
            }>
              <CardContent className="p-4 flex items-center gap-3">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    className="h-4 w-4 shrink-0 pointer-events-none"
                    aria-label="select"
                  />
                )}
                <Avatar className="h-14 w-14">
                  {c.profile_photo_url ? <AvatarImage src={c.profile_photo_url} alt={c.name} /> : null}
                  <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    <span className={c.gender === 'female' ? 'text-pink-500' : 'text-blue-500'} aria-label={c.gender}>
                      {c.gender === 'female' ? '♀' : '♂'}
                    </span>
                    {c.name}
                    <Badge variant={c.status === 'active' ? 'secondary' : 'outline'} className="capitalize">
                      {ts(c.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.breed ?? '—'} · {formatDate(c.date_of_birth)}
                  </div>
                  {c.current_room && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Home className="h-3 w-3" /> {c.current_room.name}
                    </div>
                  )}
                  {c.assignee && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <User className="h-3 w-3" /> {c.assignee.full_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );

          if (selectMode) {
            return (
              <button
                key={c.id}
                type="button"
                onClick={(e) => toggleSelect(c.id, e)}
                className="text-left"
              >
                {cardInner}
              </button>
            );
          }
          return (
            <Link
              key={c.id}
              href={`/cats/${c.id}`}
              onMouseEnter={() => prefetchCatDetail(c.id)}
              onFocus={() => prefetchCatDetail(c.id)}
              onTouchStart={() => prefetchCatDetail(c.id)}
            >
              {cardInner}
            </Link>
          );
        })}
      </div>

      <BatchAssignModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        catIds={Array.from(selectedIds)}
        onSuccess={() => { exitSelectMode(); }}
      />

      <BatchMedicationModal
        open={batchMedModalOpen}
        onClose={() => setBatchMedModalOpen(false)}
        catIds={Array.from(selectedIds)}
        onSuccess={() => { exitSelectMode(); }}
      />
    </div>
  );
}
