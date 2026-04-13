'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { roomSchema, type RoomInput } from '@/lib/schemas/rooms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Room, RoomType } from '@/lib/supabase/aliases';

const ROOM_TYPES: RoomType[] = ['breeding', 'kitten', 'quarantine', 'general', 'isolation', 'other'];

interface Props {
  mode: 'create' | 'edit';
  room?: Room;
  onDone?: (room: Room) => void;
  onCancel?: () => void;
}

export function RoomForm({ mode, room, onDone, onCancel }: Props) {
  const t = useTranslations('rooms');
  const tt = useTranslations('rooms.types');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const form = useForm<RoomInput>({
    resolver: zodResolver(roomSchema),
    values: room
      ? {
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          description: room.description ?? '',
          is_active: room.is_active
        }
      : undefined,
    defaultValues: room
      ? undefined
      : {
          name: '',
          type: 'general',
          capacity: null,
          description: '',
          is_active: true
        }
  });

  const m = useMutation({
    mutationFn: async (v: RoomInput) => {
      const isEdit = mode === 'edit' && room;
      const r = await fetch(isEdit ? `/api/rooms/${room!.id}` : '/api/rooms', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      return (await r.json()).room as Room;
    },
    onSuccess: (saved) => {
      toast.success(mode === 'edit' ? t('updated') : t('created'));
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['room', saved.id] });
      onDone?.(saved);
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-4 py-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('fields.name')}</Label>
          <Input {...form.register('name')} />
          {form.formState.errors.name?.message && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('fields.type')}</Label>
          <Select
            value={form.watch('type') ?? 'general'}
            onValueChange={(v) => form.setValue('type', v as RoomType)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((ty) => (
                <SelectItem key={ty} value={ty}>{tt(ty)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('fields.capacity')}</Label>
          <Input
            type="number"
            min={0}
            max={1000}
            {...form.register('capacity', {
              setValueAs: (v) => (v === '' || v === null ? null : Number(v))
            })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('fields.description')}</Label>
        <Textarea rows={3} {...form.register('description')} />
      </div>

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('is_active')} />
          {t('fields.active')}
        </label>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>{tc('cancel')}</Button>
        )}
        <Button type="submit" disabled={m.isPending}>
          {m.isPending ? tc('saving') : mode === 'edit' ? tc('save') : tc('create')}
        </Button>
      </div>
    </form>
  );
}
