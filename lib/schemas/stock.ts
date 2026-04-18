import { z } from 'zod';

export const stockCategorySchema = z.enum([
  'food',
  'medicine',
  'supplement',
  'litter',
  'cleaning',
  'grooming',
  'equipment',
  'other'
]);
export type StockCategory = z.infer<typeof stockCategorySchema>;

export const stockUnitSchema = z.enum([
  'pcs',
  'box',
  'bottle',
  'pack',
  'sachet',
  'bag',
  'kg',
  'g',
  'l',
  'ml'
]);
export type StockUnit = z.infer<typeof stockUnitSchema>;

export const stockMovementTypeSchema = z.enum([
  'stock_in',
  'transfer',
  'checkout',
  'consume',
  'adjust',
  'discard'
]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

// ─── Locations ───────────────────────────────────────────────────────────────
export const stockLocationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(2000).nullable().optional(),
  is_cold_storage: z.boolean().optional(),
  is_active: z.boolean().optional()
});
export type StockLocationInput = z.infer<typeof stockLocationSchema>;

export const stockLocationUpdateSchema = stockLocationSchema.partial();
export type StockLocationUpdateInput = z.infer<typeof stockLocationUpdateSchema>;

// ─── Items ───────────────────────────────────────────────────────────────────
export const stockItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  brand: z.string().max(120).nullable().optional(),
  category: stockCategorySchema.default('other'),
  unit: stockUnitSchema.default('pcs'),
  min_threshold: z.coerce.number().min(0).max(1_000_000).default(0),
  default_location_id: z.string().uuid().nullable().optional(),
  photo_url: z.string().url().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional()
});
export type StockItemInput = z.infer<typeof stockItemSchema>;

export const stockItemUpdateSchema = stockItemSchema.partial();
export type StockItemUpdateInput = z.infer<typeof stockItemUpdateSchema>;

// ─── Stock-in (creates a new batch) ──────────────────────────────────────────
export const stockInSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty: z.coerce.number().positive('Quantity must be greater than 0').max(1_000_000),
  location_id: z.string().uuid().nullable().optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
    .optional(),
  cost_per_unit: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  batch_ref: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  received_at: z.string().datetime().nullable().optional()
});
export type StockInInput = z.infer<typeof stockInSchema>;

// ─── Checkout (sitter takes qty from a specific batch) ───────────────────────
export const stockCheckoutSchema = z.object({
  batch_id: z.string().uuid(),
  qty: z.coerce.number().positive('Quantity must be greater than 0').max(1_000_000),
  for_cat_id: z.string().uuid().nullable().optional(),
  reason: z.string().max(500).nullable().optional()
});
export type StockCheckoutInput = z.infer<typeof stockCheckoutSchema>;

// ─── Transfer (admin moves a batch between locations) ────────────────────────
export const stockTransferSchema = z.object({
  batch_id: z.string().uuid(),
  to_location_id: z.string().uuid(),
  reason: z.string().max(500).nullable().optional()
});
export type StockTransferInput = z.infer<typeof stockTransferSchema>;

// ─── Adjust (+/-) ────────────────────────────────────────────────────────────
export const stockAdjustSchema = z.object({
  batch_id: z.string().uuid(),
  qty_delta: z.coerce.number().refine((n) => n !== 0, 'Delta must be non-zero'),
  reason: z.string().max(500).nullable().optional()
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
