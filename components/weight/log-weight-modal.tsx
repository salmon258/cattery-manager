'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { weightLogSchema, type WeightLogInput } from '@/lib/schemas/weight';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName?: string;
}

export function LogWeightModal({ open, onClose, catId, catName }: Props) {
  const t = useTranslations('weight');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();

  // weight_kg starts empty (not 0) so the user can type a number directly
  // rather than having to delete the zero first. zod.coerce converts the
  // string on submit. Cast to number to satisfy WeightLogInput's typed shape.
  const emptyDefaults = { weight_kg: '' as unknown as number, notes: '' };

  const form = useForm<WeightLogInput>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: emptyDefaults
  });

  const m = useMutation({
    mutationFn: async (v: WeightLogInput) => {
      const r = await fetch(`/api/cats/${catId}/weight`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('logged'));
      qc.invalidateQueries({ queryKey: ['weight', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
      qc.invalidateQueries({ queryKey: ['cat', catId] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
      form.reset(emptyDefaults);
      onClose();
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={catName ? t('titleFor', { name: catName }) : t('title')}
    >
      <form onSubmit={form.handleSubmit((v) => m.mutate(v))} className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>{t('fields.weightKg')}</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.1"
            max="29.9"
            placeholder="0.00"
            autoFocus
            {...form.register('weight_kg')}
          />
          {errors.weight_kg?.message && (
            <p className="text-xs text-destructive">{errors.weight_kg.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('fields.notes')}</Label>
          <Textarea rows={2} {...form.register('notes')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>{tc('cancel')}</Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? tc('saving') : tc('save')}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
