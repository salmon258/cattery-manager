import { z } from 'zod';

export const ticketSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ticketStatusSchema   = z.enum(['open', 'in_progress', 'resolved']);
export const ticketEventTypeSchema = z.enum(['comment', 'status_change', 'resolved', 'reopened']);

export const createTicketSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).nullable().optional(),
  severity:    ticketSeveritySchema.default('low')
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const addEventSchema = z.object({
  event_type:         ticketEventTypeSchema,
  note:               z.string().max(5000).nullable().optional(),
  new_status:         ticketStatusSchema.optional(),
  resolution_summary: z.string().max(5000).nullable().optional()
});
export type AddEventInput = z.infer<typeof addEventSchema>;
