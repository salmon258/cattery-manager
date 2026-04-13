'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { moveCatSchema, type MoveCatInput } from '@/lib/schemas/rooms';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import type { Room } from '@/lib/supabase/aliases';

type RoomWithCount = Room & { occupant_count: number };

async function fetchRooms(): Promise<RoomWithCount[]> {
  const r = await fetch('/api/rooms', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).rooms;
}

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  currentRoomId: string | null;
}

const UNASSIGNED = '__unassigned__';

export function MoveRoomModal({ open, onClose, catId, currentRoomId }: Props) {
  const t = useTranslations('rooms');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', false],
    queryFn: () => fetchRooms(),
    enabled: open
  });

  const form = useForm<MoveCatInput>({
    resolver: zodResolver(moveCatSchema),
    values: { to_room_id: currentRoomId, reason: '' }
  });

  const m = useMutation({
    mutationFn: async (v: MoveCatInput) => {
      const r = await fetch(`/api/cats/${catId}/move-room`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('moved'));
      qc.invalidateQueries({ queryKey: ['cats'] });
      qc.invalidateQueries({ queryKey: ['cat', catId] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['movements', catId] });
      onClose();
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const selectValue = form.watch('to_room_id') ?? UNASSIGNED;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()} title={t('moveTitle')}>
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>{t('destination')}</Label>
          <Select
            value={selectValue === null ? UNASSIGNED : (selectValue as string)}
            onValueChange={(v) => form.setValue('to_room_id', v === UNASSIGNED ? null : v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>{t('unassigned')}</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}{r.capacity ? ` (${r.occupant_count}/${r.capacity})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('reason')} <span className="text-muted-foreground text-xs">({tc('optional')})</span></Label>
          <Textarea rows={2} {...form.register('reason')} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : t('moveAction')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
