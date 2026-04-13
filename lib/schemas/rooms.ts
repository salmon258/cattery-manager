import { z } from 'zod';

export const roomTypeSchema = z.enum([
  'breeding',
  'kitten',
  'quarantine',
  'general',
  'isolation',
  'other'
]);
export type RoomTypeInput = z.infer<typeof roomTypeSchema>;

export const roomSchema = z.object({
  name: z.string().min(1).max(100),
  type: roomTypeSchema.default('general'),
  capacity: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional()
});
export type RoomInput = z.infer<typeof roomSchema>;

export const roomUpdateSchema = roomSchema.partial();
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;

export const moveCatSchema = z.object({
  to_room_id: z.string().uuid().nullable(),
  reason: z.string().max(500).nullable().optional()
});
export type MoveCatInput = z.infer<typeof moveCatSchema>;
