'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Users, Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import type { Room, RoomType, UserRole } from '@/lib/supabase/aliases';
import { RoomForm } from '@/components/rooms/room-form';

type RoomWithCount = Room & { occupant_count: number };

async function fetchRooms(includeInactive: boolean): Promise<RoomWithCount[]> {
  const params = new URLSearchParams();
  if (includeInactive) params.set('include_inactive', '1');
  const r = await fetch(`/api/rooms?${params.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).rooms;
}

export function RoomsClient({ role }: { role: UserRole }) {
  const t = useTranslations('rooms');
  const tc = useTranslations('common');
  const tt = useTranslations('rooms.types');
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [createOpen, setCreateOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: rooms = [], isLoading, error, refetch } = useQuery({
    queryKey: ['rooms', showInactive],
    queryFn: () => fetchRooms(showInactive)
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? t('hideInactive') : t('showInactive')}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('new')}
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>
      )}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && rooms.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('list.empty')}</CardContent></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <Link key={r.id} href={`/rooms/${r.id}`}>
            <Card className="hover:bg-accent/40 transition-colors h-full">
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!r.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
                    <Badge variant="secondary">{tt(r.type)}</Badge>
                  </div>
                </div>
                {r.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                )}
                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {r.occupant_count}{r.capacity ? ` / ${r.capacity}` : ''}
                  </span>
                  {r.capacity && r.occupant_count > r.capacity && (
                    <Badge variant="destructive">{t('overCapacity')}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <ResponsiveModal open={createOpen} onOpenChange={setCreateOpen} title={t('new')}>
        <RoomForm mode="create" onDone={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ['rooms'] }); }} />
      </ResponsiveModal>
    </div>
  );
}
