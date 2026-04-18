import { z } from 'zod';

export const financialTypeSchema = z.enum(['income', 'expense']);
export type FinancialType = z.infer<typeof financialTypeSchema>;

export const financialPaymentMethodSchema = z.enum([
  'cash',
  'bank_transfer',
  'card',
  'e_wallet',
  'other'
]);
export type FinancialPaymentMethod = z.infer<typeof financialPaymentMethodSchema>;

export const financialRelatedEntityTypeSchema = z.enum([
  'stock_batch',
  'stock_movement',
  'vet_visit',
  'adoption',
  'payroll',
  'cat',
  'other'
]);
export type FinancialRelatedEntityType = z.infer<typeof financialRelatedEntityTypeSchema>;

// ─── Categories ──────────────────────────────────────────────────────────────
export const transactionCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  type: financialTypeSchema,
  slug: z.string().max(60).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(500),
  is_active: z.boolean().optional()
});
export type TransactionCategoryInput = z.infer<typeof transactionCategorySchema>;

export const transactionCategoryUpdateSchema = transactionCategorySchema.partial();
export type TransactionCategoryUpdateInput = z.infer<typeof transactionCategoryUpdateSchema>;

// ─── Manual transactions ─────────────────────────────────────────────────────
export const financialTransactionSchema = z.object({
  type: financialTypeSchema,
  category_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().min(0).max(1_000_000_000_000),
  currency: z.string().length(3),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  description: z.string().max(2000).nullable().optional(),
  reference_number: z.string().max(120).nullable().optional(),
  receipt_url: z.string().url().max(2000).nullable().optional(),
  related_entity_type: financialRelatedEntityTypeSchema.nullable().optional(),
  related_entity_id: z.string().uuid().nullable().optional(),
  payment_method: financialPaymentMethodSchema.nullable().optional()
});
export type FinancialTransactionInput = z.infer<typeof financialTransactionSchema>;

export const financialTransactionUpdateSchema = financialTransactionSchema.partial();
export type FinancialTransactionUpdateInput = z.infer<typeof financialTransactionUpdateSchema>;
