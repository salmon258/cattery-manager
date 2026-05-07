import { z } from 'zod';

export const feedingMethodSchema = z.enum(['self', 'assisted', 'force_fed']);
export const eatenRatioSchema = z.enum(['all', 'most', 'half', 'little', 'none']);

export const eatingLogItemInputSchema = z
  .object({
    food_item_id: z.string().uuid(),
    quantity_given_g: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Must be ≥ 0')
      .max(10000, 'Too large'),
    quantity_eaten_g: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Must be ≥ 0')
      .max(10000, 'Too large'),
    quantity_eaten: eatenRatioSchema.default('all')
  })
  .refine((v) => v.quantity_eaten_g <= v.quantity_given_g, {
    message: 'Eaten cannot exceed given',
    path: ['quantity_eaten_g']
  });
export type EatingLogItemInput = z.infer<typeof eatingLogItemInputSchema>;

export const eatingLogSchema = z.object({
  meal_time: z.string().datetime({ offset: true }).optional(),
  feeding_method: feedingMethodSchema.default('self'),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(eatingLogItemInputSchema).min(1, 'At least one food item is required')
});
export type EatingLogInput = z.infer<typeof eatingLogSchema>;

// Keep these in sync with the SQL generated column in eating_log_items.
export const EATEN_RATIO_FACTOR: Record<z.infer<typeof eatenRatioSchema>, number> = {
  all: 1,
  most: 0.75,
  half: 0.5,
  little: 0.2,
  none: 0
};
