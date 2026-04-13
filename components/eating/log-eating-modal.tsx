'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import type { EatenRatio, FeedingMethod, FoodItem } from '@/lib/supabase/aliases';
import { eatingLogSchema, type EatingLogInput, EATEN_RATIO_FACTOR } from '@/lib/schemas/eating';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const METHODS: FeedingMethod[] = ['self', 'assisted', 'force_fed'];
const RATIOS: EatenRatio[] = ['all', 'most', 'half', 'little', 'none'];

async function fetchFoodItems(): Promise<FoodItem[]> {
  const r = await fetch('/api/food-items', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).items;
}

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName?: string;
}

export function LogEatingModal({ open, onClose, catId, catName }: Props) {
  const t = useTranslations('eating');
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();

  const { data: foods = [] } = useQuery({
    queryKey: ['food-items', false],
    queryFn: fetchFoodItems,
    enabled: open
  });

  const form = useForm<EatingLogInput>({
    resolver: zodResolver(eatingLogSchema),
    defaultValues: {
      feeding_method: 'self',
      notes: '',
      items: [{ food_item_id: '', quantity_given_g: 50, quantity_eaten: 'all' }]
    }
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    if (open) form.reset({ feeding_method: 'self', notes: '', items: [{ food_item_id: '', quantity_given_g: 50, quantity_eaten: 'all' }] });
  }, [open, form]);

  // Live total kcal estimate.
  const watchedItems = form.watch('items');
  const totalKcal = (watchedItems ?? []).reduce((acc, it) => {
    const food = foods.find((f) => f.id === it?.food_item_id);
    if (!food || !it?.quantity_given_g) return acc;
    const factor = EATEN_RATIO_FACTOR[it.quantity_eaten ?? 'all'] ?? 0;
    return acc + Number(it.quantity_given_g) * Number(food.calories_per_gram) * factor;
  }, 0);

  const m = useMutation({
    mutationFn: async (v: EatingLogInput) => {
      const r = await fetch(`/api/cats/${catId}/eating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('logged'));
      qc.invalidateQueries({ queryKey: ['eating', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
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
          <Label>{t('fields.feedingMethod')}</Label>
          <Select
            value={form.watch('feeding_method') ?? 'self'}
            onValueChange={(v) => form.setValue('feeding_method', v as FeedingMethod)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>{t(`methods.${m}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('fields.items')}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ food_item_id: '', quantity_given_g: 0, quantity_eaten: 'all' })}
            >
              <Plus className="h-3 w-3" /> {t('addFood')}
            </Button>
          </div>

          {fields.map((field, idx) => {
            const rowError = errors.items?.[idx];
            return (
              <div key={field.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Select
                      value={form.watch(`items.${idx}.food_item_id`) ?? ''}
                      onValueChange={(v) => form.setValue(`items.${idx}.food_item_id`, v)}
                    >
                      <SelectTrigger><SelectValue placeholder={t('selectFood')} /></SelectTrigger>
                      <SelectContent>
                        {foods.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} {f.brand ? `(${f.brand})` : ''} — {f.calories_per_gram} kcal/g
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rowError?.food_item_id?.message && (
                      <p className="text-xs text-destructive">{rowError.food_item_id.message}</p>
                    )}
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('fields.quantityGivenG')}</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      {...form.register(`items.${idx}.quantity_given_g`)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('fields.quantityEaten')}</Label>
                    <Select
                      value={form.watch(`items.${idx}.quantity_eaten`) ?? 'all'}
                      onValueChange={(v) => form.setValue(`items.${idx}.quantity_eaten`, v as EatenRatio)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RATIOS.map((r) => (
                          <SelectItem key={r} value={r}>{t(`ratios.${r}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}

          {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>{t('fields.notes')}</Label>
          <Textarea rows={2} {...form.register('notes')} />
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">{t('totalKcal')}</span>
          <span className="font-semibold">{Math.round(totalKcal)} kcal</span>
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
