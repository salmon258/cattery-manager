import { z } from 'zod';

export const weightLogSchema = z.object({
  weight_kg: z.coerce
    .number({ invalid_type_error: 'Enter a number' })
    .gt(0, 'Weight must be positive')
    .lt(30, 'Weight must be below 30 kg'),
  recorded_at: z.string().datetime({ offset: true }).optional(),
  photo_url: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});
export type WeightLogInput = z.infer<typeof weightLogSchema>;
