'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { catSchema, type CatInput } from '@/lib/schemas/cats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Cat } from '@/lib/supabase/aliases';

interface Props {
  mode: 'create' | 'edit';
  cat?: Cat;
}

export function CatForm({ mode, cat }: Props) {
  const t = useTranslations('cats');
  const tg = useTranslations('cats.gender');
  const ts = useTranslations('cats.status');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();

  const form = useForm<CatInput>({
    resolver: zodResolver(catSchema),
    defaultValues: cat
      ? {
          name: cat.name,
          date_of_birth: cat.date_of_birth,
          gender: cat.gender,
          breed: cat.breed ?? '',
          microchip_number: cat.microchip_number ?? '',
          registration_number: cat.registration_number ?? '',
          color_pattern: cat.color_pattern ?? '',
          status: cat.status,
          assignee_id: cat.assignee_id ?? null,
          notes: cat.notes ?? ''
        }
      : {
          name: '',
          date_of_birth: '',
          gender: 'female',
          status: 'active'
        }
  });

  const m = useMutation({
    mutationFn: async (v: CatInput) => {
      const isEdit = mode === 'edit' && cat;
      const r = await fetch(isEdit ? `/api/cats/${cat!.id}` : '/api/cats', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
      return (await r.json()).cat as Cat;
    },
    onSuccess: (saved) => {
      toast.success(mode === 'edit' ? t('updated') : t('created'));
      qc.invalidateQueries({ queryKey: ['cats'] });
      qc.invalidateQueries({ queryKey: ['cat', saved.id] });
      router.push(`/cats/${saved.id}`);
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  return (
    <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fields.name')} error={form.formState.errors.name?.message}>
          <Input {...form.register('name')} />
        </Field>
        <Field label={t('fields.dateOfBirth')} error={form.formState.errors.date_of_birth?.message}>
          <Input type="date" {...form.register('date_of_birth')} />
        </Field>
        <Field label={t('fields.gender')}>
          <Select value={form.watch('gender')} onValueChange={(v) => form.setValue('gender', v as 'male' | 'female')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{tg('male')}</SelectItem>
              <SelectItem value="female">{tg('female')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('fields.status')}>
          <Select
            value={form.watch('status') ?? 'active'}
            onValueChange={(v) => form.setValue('status', v as CatInput['status'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['active', 'retired', 'deceased', 'sold'] as const).map((s) => (
                <SelectItem key={s} value={s}>{ts(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('fields.breed')}><Input {...form.register('breed')} /></Field>
        <Field label={t('fields.colorPattern')}><Input {...form.register('color_pattern')} /></Field>
        <Field label={t('fields.microchip')}><Input {...form.register('microchip_number')} /></Field>
        <Field label={t('fields.registration')}><Input {...form.register('registration_number')} /></Field>
      </div>

      <Field label={t('fields.notes')}>
        <Textarea rows={4} {...form.register('notes')} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>{tc('cancel')}</Button>
        <Button type="submit" disabled={m.isPending}>
          {m.isPending ? tc('saving') : mode === 'edit' ? tc('save') : tc('create')}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
