'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Room, RoomMovement } from '@/lib/supabase/aliases';
import { formatDate } from '@/lib/utils';

type RoomWithCount = Room & { occupant_count: number };

async function fetchMovements(catId: string): Promise<RoomMovement[]> {
  const r = await fetch(`/api/cats/${catId}/movements`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).movements;
}

async function fetchRooms(): Promise<RoomWithCount[]> {
  const r = await fetch('/api/rooms?include_inactive=1', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).rooms;
}

export function CatRoomHistory({ catId }: { catId: string }) {
  const t = useTranslations('rooms');
  const tc = useTranslations('common');

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['movements', catId],
    queryFn: () => fetchMovements(catId)
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', 'all'],
    queryFn: () => fetchRooms()
  });

  const nameOf = (id: string | null) => {
    if (!id) return t('unassigned');
    return rooms.find((r) => r.id === id)?.name ?? '—';
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader><CardTitle className="text-base">{t('roomHistory')}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tc('empty')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {movements.map((mv) => (
              <li key={mv.id} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground">
                      {mv.from_room_id ? (
                        <Link href={`/rooms/${mv.from_room_id}`} className="hover:underline">
                          {nameOf(mv.from_room_id)}
                        </Link>
                      ) : (
                        nameOf(null)
                      )}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium">
                      {mv.to_room_id ? (
                        <Link href={`/rooms/${mv.to_room_id}`} className="hover:underline">
                          {nameOf(mv.to_room_id)}
                        </Link>
                      ) : (
                        nameOf(null)
                      )}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDate(mv.moved_at)}
                  </span>
                </div>
                {mv.reason && (
                  <p className="text-xs text-muted-foreground italic break-words whitespace-pre-wrap">
                    “{mv.reason}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
