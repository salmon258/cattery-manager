// Local types used by the /finance UI. Mirrors the row shapes returned by
// the API routes — kept here instead of aliases.ts so we don't block on
// `supabase gen types` regeneration.

export type FinancialType = 'income' | 'expense';
export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'card'
  | 'e_wallet'
  | 'other';
export type RelatedEntityType =
  | 'stock_batch'
  | 'stock_movement'
  | 'vet_visit'
  | 'adoption'
  | 'payroll'
  | 'cat'
  | 'other';
export type PayrollStatus = 'pending' | 'paid' | 'cancelled';

export interface TransactionCategory {
  id: string;
  name: string;
  type: FinancialType;
  slug: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  type: FinancialType;
  category_id: string | null;
  amount: number | string;
  currency: string;
  transaction_date: string;
  description: string | null;
  reference_number: string | null;
  receipt_url: string | null;
  related_entity_type: RelatedEntityType | null;
  related_entity_id: string | null;
  payment_method: PaymentMethod | null;
  auto_generated: boolean;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  category: Pick<TransactionCategory, 'id' | 'name' | 'slug' | 'type'> | null;
}

export interface FinanceProfileLite {
  id: string;
  full_name: string;
  role: 'admin' | 'cat_sitter';
  is_active: boolean;
}

export interface ProfileSalary {
  id: string;
  profile_id: string;
  monthly_salary: number | string;
  currency: string;
  effective_from: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: FinanceProfileLite | null;
}

export interface PayrollEntry {
  id: string;
  profile_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number | string;
  bonus_amount: number | string;
  deduction_amount: number | string;
  net_amount: number | string;
  currency: string;
  status: PayrollStatus;
  payment_date: string | null;
  payment_method: PaymentMethod | null;
  transfer_proof_url: string | null;
  transfer_proof_path: string | null;
  reference_number: string | null;
  notes: string | null;
  financial_txn_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: FinanceProfileLite | null;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'card',
  'e_wallet',
  'other'
];

export const PAYROLL_STATUSES: PayrollStatus[] = ['pending', 'paid', 'cancelled'];
