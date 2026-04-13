import { z } from 'zod';

export const foodTypeSchema = z.enum(['wet', 'dry', 'raw', 'treat', 'supplement', 'other']);
export const foodUnitSchema = z.enum(['g', 'ml', 'sachet', 'piece']);

export const foodItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  brand: z.string().max(120).nullable().optional(),
  type: foodTypeSchema.default('dry'),
  calories_per_gram: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .min(0, 'Must be ≥ 0')
    .max(20, 'Value seems too high'),
  unit: foodUnitSchema.default('g'),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional()
});
export type FoodItemInput = z.infer<typeof foodItemSchema>;

export const foodItemUpdateSchema = foodItemSchema.partial();
export type FoodItemUpdateInput = z.infer<typeof foodItemUpdateSchema>;
