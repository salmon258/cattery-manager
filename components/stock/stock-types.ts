/**
 * Inline types for Phase 13 stock feature. Once `supabase gen types` is run
 * post-migration, equivalents can be added to lib/supabase/aliases.ts and
 * these re-exported. Following Phase 10 (vet) convention.
 */

export type StockCategory =
  | 'food' | 'medicine' | 'supplement' | 'litter'
  | 'cleaning' | 'grooming' | 'equipment' | 'other';

export type StockUnit =
  | 'pcs' | 'box' | 'bottle' | 'pack' | 'sachet'
  | 'bag' | 'kg' | 'g' | 'l' | 'ml';

export type StockMovementType =
  | 'stock_in' | 'transfer' | 'checkout'
  | 'consume' | 'adjust' | 'discard';

export interface StockLocation {
  id: string;
  name: string;
  description: string | null;
  is_cold_storage: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItem {
  id: string;
  name: string;
  brand: string | null;
  category: StockCategory;
  unit: StockUnit;
  min_threshold: number;
  default_location_id: string | null;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockBatch {
  id: string;
  stock_item_id: string;
  location_id: string | null;
  qty_initial: number;
  qty_remaining: number;
  expiry_date: string | null;
  cost_per_unit: number | null;
  currency: string | null;
  batch_ref: string | null;
  received_at: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItemStatus {
  stock_item_id: string;
  name: string;
  brand: string | null;
  category: StockCategory;
  unit: StockUnit;
  min_threshold: number;
  is_active: boolean;
  qty_on_hand: number;
  active_batches: number;
  earliest_expiry: string | null;
  is_low_stock: boolean;
}

export interface StockExpiringBatch {
  batch_id: string;
  stock_item_id: string;
  item_name: string;
  category: StockCategory;
  unit: StockUnit;
  location_id: string | null;
  location_name: string | null;
  qty_remaining: number;
  expiry_date: string;
  days_to_expiry: number;
}

export interface StockMovement {
  id: string;
  batch_id: string;
  type: StockMovementType;
  qty_delta: number;
  from_location_id: string | null;
  to_location_id: string | null;
  for_cat_id: string | null;
  moved_by: string | null;
  moved_at: string;
  reason: string | null;
  created_at: string;
  // Joined rows from /api/stock/movements
  batch?: {
    id: string;
    stock_item_id: string;
    location_id: string | null;
    expiry_date: string | null;
    cost_per_unit: number | null;
    currency: string | null;
    batch_ref: string | null;
    item?: { id: string; name: string; brand: string | null; category: StockCategory; unit: StockUnit };
  };
  for_cat?: { id: string; name: string } | null;
  moved_by_profile?: { id: string; full_name: string } | null;
}

export const STOCK_CATEGORIES: StockCategory[] = [
  'food', 'medicine', 'supplement', 'litter', 'cleaning', 'grooming', 'equipment', 'other'
];
export const STOCK_UNITS: StockUnit[] = [
  'pcs', 'box', 'bottle', 'pack', 'sachet', 'bag', 'kg', 'g', 'l', 'ml'
];
export const STOCK_MOVEMENT_TYPES: StockMovementType[] = [
  'stock_in', 'transfer', 'checkout', 'consume', 'adjust', 'discard'
];
