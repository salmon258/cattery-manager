'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import type { EatenRatio, FeedingMethod, FoodItem } from '@/lib/supabase/aliases';
import { type EatingLogInput } from '@/lib/schemas/eating';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const METHODS: FeedingMethod[] = ['self', 'assisted', 'force_fed'];

async function fetchFoodItems(): Promise<FoodItem[]> {
  const r = await fetch('/api/food-items', { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).items;
}

/**
 * Form-local schema: sitters enter the actual grams given AND grams eaten,
 * which is much clearer than picking "ate most / ate half". `eaten_g`
 * defaults to whatever `given_g` is so a fully-eaten meal is one tap.
 * On submit we convert the eaten/given ratio back into the enum value the
 * DB column expects (the `estimated_kcal_consumed` generated column still
 * reads the enum), picking the closest available factor.
 */
const eatingFormItemSchema = z
  .object({
    food_item_id: z.string().uuid({ message: 'Select a food item' }),
    given_g: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Must be ≥ 0')
      .max(10000, 'Too large'),
    eaten_g: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Must be ≥ 0')
      .max(10000, 'Too large')
  })
  .refine((v) => v.eaten_g <= v.given_g, {
    message: 'Eaten cannot exceed given',
    path: ['eaten_g']
  });

const eatingFormSchema = z.object({
  feeding_method: z.enum(['self', 'assisted', 'force_fed']).default('self'),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(eatingFormItemSchema).min(1, 'At least one food item is required')
});
type EatingFormInput = z.infer<typeof eatingFormSchema>;

// Map an eaten/given ratio to the nearest DB enum. Breakpoints sit at the
// midpoints between the factors stored in the eating_log_items generated
// column (1, 0.75, 0.5, 0.2, 0). Eaten == 0 always becomes 'none', and any
// non-zero sliver becomes at least 'little' to match user intent.
function ratioToEnum(given: number, eaten: number): EatenRatio {
  if (given <= 0 || eaten <= 0) return 'none';
  const r = eaten / given;
  if (r >= 0.875) return 'all';
  if (r >= 0.625) return 'most';
  if (r >= 0.35)  return 'half';
  return 'little';
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

  const emptyItem = { food_item_id: '', given_g: 0, eaten_g: 0 };
  const emptyDefaults: EatingFormInput = {
    feeding_method: 'self',
    notes: '',
    items: [emptyItem]
  };

  const form = useForm<EatingFormInput>({
    resolver: zodResolver(eatingFormSchema),
    defaultValues: emptyDefaults
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    if (open) form.reset(emptyDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live total kcal estimate based on the raw gram figures (no enum rounding
  // yet): eaten_g × kcal/g. This keeps the number the sitter sees in sync
  // with the grams they entered, even if the stored enum will be rounded.
  const watchedItems = form.watch('items');
  const totalKcal = (watchedItems ?? []).reduce((acc, it) => {
    const food = foods.find((f) => f.id === it?.food_item_id);
    if (!food || !it) return acc;
    const eaten = Number(it.eaten_g ?? 0);
    return acc + eaten * Number(food.calories_per_gram);
  }, 0);

  const m = useMutation({
    mutationFn: async (v: EatingFormInput) => {
      const payload: EatingLogInput = {
        feeding_method: v.feeding_method,
        notes: v.notes ?? null,
        items: v.items.map((it) => ({
          food_item_id: it.food_item_id,
          quantity_given_g: Number(it.given_g),
          quantity_eaten: ratioToEnum(Number(it.given_g), Number(it.eaten_g))
        }))
      };
      const r = await fetch(`/api/cats/${catId}/eating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(t('logged'));
      qc.invalidateQueries({ queryKey: ['eating', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
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
              onClick={() => append(emptyItem)}
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
                    <Label className="text-xs text-muted-foreground">{t('fields.givenG')}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      placeholder="50"
                      {...form.register(`items.${idx}.given_g`, {
                        // Mirror the given amount into the eaten field so a
                        // fully-eaten meal is a single entry. Sitters only
                        // need to touch "eaten" when it was a partial eat.
                        onChange: (e) => {
                          const next = e.target.value;
                          form.setValue(`items.${idx}.eaten_g`, next as unknown as number, {
                            shouldDirty: true,
                            shouldValidate: false
                          });
                        }
                      })}
                    />
                    {rowError?.given_g?.message && (
                      <p className="text-xs text-destructive">{rowError.given_g.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('fields.eatenG')}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      placeholder="50"
                      {...form.register(`items.${idx}.eaten_g`)}
                    />
                    {rowError?.eaten_g?.message && (
                      <p className="text-xs text-destructive">{rowError.eaten_g.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{t('eatenHint')}</p>
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
