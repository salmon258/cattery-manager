'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import type { EatenRatio, FeedingMethod, FoodItem, FoodType } from '@/lib/supabase/aliases';
import { EATEN_RATIO_FACTOR, type EatingLogInput } from '@/lib/schemas/eating';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

const METHODS: FeedingMethod[] = ['self', 'assisted', 'force_fed'];

// Order in which categories appear in the grouped food dropdown. Wet/dry sit
// at the top because they account for the majority of meal logs; `other`
// stays last as a catch-all. Tailwind classes are written as full literals
// so the JIT picks them up instead of building them at runtime.
const FOOD_TYPE_ORDER: FoodType[] = ['wet', 'dry', 'raw', 'treat', 'supplement', 'other'];
const FOOD_TYPE_STYLES: Record<FoodType, { label: string; dot: string; item: string }> = {
  wet:        { label: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-500',    item: 'border-l-4 border-l-sky-500' },
  dry:        { label: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500',  item: 'border-l-4 border-l-amber-500' },
  raw:        { label: 'text-rose-700 dark:text-rose-300',     dot: 'bg-rose-500',   item: 'border-l-4 border-l-rose-500' },
  treat:      { label: 'text-pink-700 dark:text-pink-300',     dot: 'bg-pink-500',   item: 'border-l-4 border-l-pink-500' },
  supplement: { label: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', item: 'border-l-4 border-l-violet-500' },
  other:      { label: 'text-slate-600 dark:text-slate-300',   dot: 'bg-slate-400',  item: 'border-l-4 border-l-slate-400' }
};

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

export type EditableEatingLog = {
  id: string;
  feeding_method: FeedingMethod;
  notes: string | null;
  items: Array<{
    food_item_id: string;
    quantity_given_g: number | string;
    quantity_eaten: EatenRatio;
  }>;
};

interface Props {
  open: boolean;
  onClose: () => void;
  catId: string;
  catName?: string;
  /**
   * When provided, the modal renders in edit mode: it PATCHes the existing
   * log instead of creating a new one and pre-fills the form from the log.
   */
  editLog?: EditableEatingLog | null;
}

export function LogEatingModal({ open, onClose, catId, catName, editLog }: Props) {
  const t = useTranslations('eating');
  const tc = useTranslations('common');
  const tf = useTranslations('food');
  const qc = useQueryClient();
  const isEdit = !!editLog;

  const { data: foods = [] } = useQuery({
    queryKey: ['food-items', false],
    queryFn: fetchFoodItems,
    enabled: open
  });

  // Pre-group the food list by type so the dropdown renders one
  // `SelectGroup` per category. Unknown types fall through into `other` so
  // the dropdown stays complete even if the DB adds a new enum value ahead
  // of the client build.
  const groupedFoods = FOOD_TYPE_ORDER.map((type) => ({
    type,
    items: foods.filter((f) =>
      type === 'other'
        ? !FOOD_TYPE_ORDER.slice(0, -1).includes(f.type)
        : f.type === type
    )
  })).filter((g) => g.items.length > 0);

  const emptyItem = { food_item_id: '', given_g: 0, eaten_g: 0 };
  const emptyDefaults: EatingFormInput = {
    feeding_method: 'self',
    notes: '',
    items: [emptyItem]
  };

  // Translate an existing log back into form state. `given_g` comes directly
  // from the stored column; `eaten_g` is reconstructed from the eaten-ratio
  // enum × given so the edit view mirrors what the sitter originally entered.
  // There's inherent precision loss here (the ratio is bucketed), but that's
  // intentional — sitters rarely care about the exact pre-edit gram value.
  function editDefaults(log: EditableEatingLog): EatingFormInput {
    return {
      feeding_method: log.feeding_method,
      notes: log.notes ?? '',
      items: log.items.length
        ? log.items.map((it) => {
            const given = Number(it.quantity_given_g ?? 0);
            return {
              food_item_id: it.food_item_id,
              given_g: given,
              eaten_g: given * (EATEN_RATIO_FACTOR[it.quantity_eaten] ?? 1)
            };
          })
        : [emptyItem]
    };
  }

  const form = useForm<EatingFormInput>({
    resolver: zodResolver(eatingFormSchema),
    defaultValues: editLog ? editDefaults(editLog) : emptyDefaults
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: 'items' });

  // Explicitly `replace` the field array after `form.reset`. `form.reset`
  // alone does not always re-sync useFieldArray's internal `fields` when
  // the items array's length changes — stale entries could leak through on
  // submit, which caused edits to keep the old food AND add the new one
  // when the user tried to swap items.
  useEffect(() => {
    if (!open) return;
    const defaults = editLog ? editDefaults(editLog) : emptyDefaults;
    form.reset(defaults);
    replace(defaults.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editLog]);

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
      const url = isEdit ? `/api/eating-logs/${editLog!.id}` : `/api/cats/${catId}/eating`;
      const r = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success(isEdit ? t('updated') : t('logged'));
      // Skip router.refresh() so the sitter's scroll position on /my-cats
      // isn't reset after every quick action. The cat-detail cards all read
      // through these React Query keys, so invalidation is enough.
      qc.invalidateQueries({ queryKey: ['eating', catId] });
      qc.invalidateQueries({ queryKey: ['calorie-summary', catId] });
      qc.invalidateQueries({ queryKey: ['me-cats'] });
      qc.invalidateQueries({ queryKey: ['daily-progress'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const errors = form.formState.errors;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={
        isEdit
          ? t('editTitle')
          : catName
            ? t('titleFor', { name: catName })
            : t('title')
      }
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
                        {groupedFoods.map((group) => {
                          const style = FOOD_TYPE_STYLES[group.type];
                          return (
                            <SelectGroup key={group.type}>
                              <SelectLabel className={cn('flex items-center gap-2', style.label)}>
                                <span className={cn('inline-block h-2 w-2 rounded-full', style.dot)} />
                                {tf(`types.${group.type}`)}
                              </SelectLabel>
                              {group.items.map((f) => (
                                <SelectItem
                                  key={f.id}
                                  value={f.id}
                                  className={cn(style.item, style.label)}
                                  textValue={`${f.name}${f.brand ? ` (${f.brand})` : ''}`}
                                >
                                  {f.name} {f.brand ? `(${f.brand})` : ''} — {f.calories_per_gram} kcal/g
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
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
