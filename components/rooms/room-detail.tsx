'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Edit, Trash2, Users } from 'lucide-react';

import type { Cat, Room, RoomMovement, UserRole } from '@/lib/supabase/aliases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { RoomForm } from '@/components/rooms/room-form';
import { formatDate } from '@/lib/utils';

type OccupantCat = Pick<Cat, 'id' | 'name' | 'profile_photo_url' | 'status' | 'breed' | 'assignee_id'>;

interface Props {
  room: Room;
  initialOccupants: OccupantCat[];
  initialMovements: RoomMovement[];
  role: UserRole;
}

export function RoomDetail({ room, initialOccupants, initialMovements, role }: Props) {
  const t = useTranslations('rooms');
  const tt = useTranslations('rooms.types');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = role === 'admin';

  const [editOpen, setEditOpen] = useState(false);

  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('deactivated'));
      qc.invalidateQueries({ queryKey: ['rooms'] });
      router.push('/rooms');
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const capacityFull = room.capacity !== null && initialOccupants.length > (room.capacity ?? Infinity);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {room.name}
            <Badge variant="secondary">{tt(room.type)}</Badge>
            {!room.is_active && <Badge variant="destructive">{t('inactive')}</Badge>}
          </h1>
          {room.description && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{room.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {initialOccupants.length}{room.capacity ? ` / ${room.capacity}` : ''} {t('occupants')}
            {capacityFull && <Badge variant="destructive" className="ml-1">{t('overCapacity')}</Badge>}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4" /> {tc('edit')}
            </Button>
            {room.is_active && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(t('deactivateConfirm'))) del.mutate();
                }}
                disabled={del.isPending || initialOccupants.length > 0}
                title={initialOccupants.length > 0 ? t('hasOccupants') : undefined}
              >
                <Trash2 className="h-4 w-4" /> {t('deactivate')}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t('currentOccupants')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {initialOccupants.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noOccupants')}</p>
            ) : (
              <ul className="space-y-2">
                {initialOccupants.map((c) => (
                  <li key={c.id}>
                    <Link href={`/cats/${c.id}`} className="flex items-center gap-3 rounded-md hover:bg-accent/40 p-2 -mx-2">
                      <Avatar className="h-10 w-10">
                        {c.profile_photo_url ? <AvatarImage src={c.profile_photo_url} alt={c.name} /> : null}
                        <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.breed ?? '—'}</div>
                      </div>
                      <Badge variant="outline" className="capitalize">{c.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t('movementHistory')}</CardTitle></CardHeader>
          <CardContent>
            {initialMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc('empty')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {initialMovements.map((mv) => {
                  const direction = mv.to_room_id === room.id ? 'in' : 'out';
                  return (
                    <li key={mv.id} className="flex items-center gap-2 justify-between border-b pb-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <Link href={`/cats/${mv.cat_id}`} className="font-medium hover:underline">
                          {t(direction === 'in' ? 'movedIn' : 'movedOut')}
                        </Link>
                        {mv.reason && (
                          <div className="text-xs text-muted-foreground truncate italic">“{mv.reason}”</div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(mv.moved_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsiveModal open={editOpen} onOpenChange={setEditOpen} title={tc('edit')}>
        <RoomForm
          mode="edit"
          room={room}
          onDone={() => {
            setEditOpen(false);
            router.refresh();
          }}
          onCancel={() => setEditOpen(false)}
        />
      </ResponsiveModal>
    </div>
  );
}
