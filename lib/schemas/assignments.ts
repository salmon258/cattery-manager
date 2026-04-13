import { z } from 'zod';

export const assignCatSchema = z.object({
  assignee_id: z.string().uuid().nullable()
});
export type AssignCatInput = z.infer<typeof assignCatSchema>;

export const batchAssignCatsSchema = z.object({
  cat_ids:     z.array(z.string().uuid()).min(1).max(500),
  assignee_id: z.string().uuid().nullable()
});
export type BatchAssignCatsInput = z.infer<typeof batchAssignCatsSchema>;

// Payload for PATCH /api/users/[id] when deactivating a cat_sitter who has
// assigned cats. `reassign_to` accepts a cat_sitter uuid or null (unassign).
export const deactivateWithReassignSchema = z.object({
  is_active: z.literal(false),
  reassign_to: z.string().uuid().nullable()
});
export type DeactivateWithReassignInput = z.infer<typeof deactivateWithReassignSchema>;
