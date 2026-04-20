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

// ─── Payroll — profile salaries ──────────────────────────────────────────────
export const profileSalarySchema = z.object({
  profile_id: z.string().uuid(),
  monthly_salary: z.coerce.number().min(0).max(1_000_000_000_000),
  currency: z.string().length(3),
  effective_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  notes: z.string().max(2000).nullable().optional()
});
export type ProfileSalaryInput = z.infer<typeof profileSalarySchema>;

export const profileSalaryUpdateSchema = profileSalarySchema
  .omit({ profile_id: true })
  .partial();
export type ProfileSalaryUpdateInput = z.infer<typeof profileSalaryUpdateSchema>;

// ─── Payroll — entries ───────────────────────────────────────────────────────
export const payrollStatusSchema = z.enum(['pending', 'paid', 'cancelled']);
export type PayrollStatus = z.infer<typeof payrollStatusSchema>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const nullableDate = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  dateStr.nullable()
);
const nullableString = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string().max(max).nullable()
  );

export const payrollEntrySchema = z
  .object({
    profile_id: z.string().uuid(),
    period_start: dateStr,
    period_end: dateStr,
    gross_amount: z.coerce.number().min(0).max(1_000_000_000_000),
    bonus_amount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
    deduction_amount: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
    net_amount: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
    currency: z.string().length(3),
    status: payrollStatusSchema.default('pending'),
    payment_date: nullableDate.optional(),
    payment_method: financialPaymentMethodSchema.nullable().optional(),
    transfer_proof_url: nullableString(2000).optional(),
    transfer_proof_path: nullableString(500).optional(),
    reference_number: nullableString(120).optional(),
    notes: nullableString(2000).optional()
  })
  .refine((d) => d.period_end >= d.period_start, {
    message: 'Period end must be on or after period start',
    path: ['period_end']
  })
  .refine((d) => d.status !== 'paid' || !!d.payment_date, {
    message: 'Payment date is required when status is paid',
    path: ['payment_date']
  });
export type PayrollEntryInput = z.infer<typeof payrollEntrySchema>;

export const payrollEntryUpdateSchema = z
  .object({
    period_start: dateStr.optional(),
    period_end: dateStr.optional(),
    gross_amount: z.coerce.number().min(0).optional(),
    bonus_amount: z.coerce.number().min(0).optional(),
    deduction_amount: z.coerce.number().min(0).optional(),
    net_amount: z.coerce.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    status: payrollStatusSchema.optional(),
    payment_date: nullableDate.optional(),
    payment_method: financialPaymentMethodSchema.nullable().optional(),
    transfer_proof_url: nullableString(2000).optional(),
    transfer_proof_path: nullableString(500).optional(),
    reference_number: nullableString(120).optional(),
    notes: nullableString(2000).optional()
  })
  .refine(
    (d) =>
      d.period_start === undefined ||
      d.period_end === undefined ||
      d.period_end >= d.period_start,
    { message: 'Period end must be on or after period start', path: ['period_end'] }
  );
export type PayrollEntryUpdateInput = z.infer<typeof payrollEntryUpdateSchema>;
