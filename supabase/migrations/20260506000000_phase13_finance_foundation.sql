-- Phase 13 — Finance Foundation
-- Minimal slice of §9 "Financial Accounting" needed to track stock spending
-- today, while leaving the exact table shape that future phases will extend:
--   * transaction_categories  — admin-configurable list
--   * financial_transactions  — generic income / expense ledger
--
-- What ships now:
--   * Both tables with full final shape (so later phases add rows, not columns)
--   * Default categories seeded
--   * Auto-trigger: when a `stock_in` movement lands and the batch has a
--     cost_per_unit, insert an Expense transaction under "Stock Purchase",
--     linked back to the batch via related_entity_type/id.
--
-- What ships later (already anticipated in the shape):
--   * Payroll trigger (on payroll_entries insert)
--   * Vet visit trigger (on vet_visits.visit_cost / transport_cost)
--   * Adoption trigger (on adoption records)
--   * Manual Income/Expense entry UI (only Admin, gated by is_admin())

-- ============================================================================
-- Enums
-- ============================================================================
create type financial_transaction_type as enum ('income', 'expense');
create type financial_related_entity_type as enum (
  'stock_batch', 'stock_movement', 'vet_visit', 'adoption', 'payroll', 'cat', 'other'
);
create type financial_payment_method as enum (
  'cash', 'bank_transfer', 'card', 'e_wallet', 'other'
);

-- ============================================================================
-- transaction_categories
-- ============================================================================
create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type financial_transaction_type not null,
  -- system categories back auto-created transactions and should not be deleted
  is_system boolean not null default false,
  slug text unique,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transaction_categories_name_type_active_key
  on public.transaction_categories(lower(name), type)
  where is_active;

create index transaction_categories_type_idx on public.transaction_categories(type);

create trigger transaction_categories_set_updated_at
  before update on public.transaction_categories
  for each row execute function public.set_updated_at();

-- Seed default categories. `slug` is stable for lookup by trigger.
insert into public.transaction_categories (name, type, is_system, slug, sort_order) values
  ('Stock Purchase',   'expense', true, 'stock_purchase',   10),
  ('Food & Supplies',  'expense', true, 'food_supplies',    20),
  ('Medicine & Vitamins','expense', true, 'medicine_vitamins', 30),
  ('Vet & Medical',    'expense', true, 'vet_medical',      40),
  ('Transport',        'expense', true, 'transport',        50),
  ('Grooming',         'expense', false, 'grooming',        60),
  ('Staff Payroll',    'expense', true, 'staff_payroll',    70),
  ('Equipment',        'expense', false, 'equipment',       80),
  ('Utilities',        'expense', false, 'utilities',       90),
  ('Electricity',      'expense', false, 'electricity',    100),
  ('Other Expense',    'expense', false, 'other_expense',  990),
  ('Adoption Fee',     'income',  true, 'adoption_fee',     10),
  ('Kitten Sale',      'income',  false, 'kitten_sale',     20),
  ('Stud Fee',         'income',  false, 'stud_fee',        30),
  ('Boarding Fee',     'income',  false, 'boarding_fee',    40),
  ('Other Income',     'income',  false, 'other_income',   990);

-- ============================================================================
-- financial_transactions — generic ledger
-- ============================================================================
create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  type financial_transaction_type not null,
  category_id uuid references public.transaction_categories(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null,
  transaction_date date not null default current_date,
  description text,
  reference_number text,
  receipt_url text,
  related_entity_type financial_related_entity_type,
  related_entity_id uuid,
  payment_method financial_payment_method,
  auto_generated boolean not null default false,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index financial_transactions_type_date_idx
  on public.financial_transactions(type, transaction_date desc);
create index financial_transactions_category_idx
  on public.financial_transactions(category_id);
create index financial_transactions_related_idx
  on public.financial_transactions(related_entity_type, related_entity_id)
  where related_entity_type is not null;

create trigger financial_transactions_set_updated_at
  before update on public.financial_transactions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-generate Expense on stock_in movements with a cost_per_unit
-- Fires AFTER INSERT on stock_movements (type='stock_in'); amount = qty × cost.
-- Currency falls back to system default if batch currency is null.
-- SECURITY DEFINER bypasses RLS so the ledger row lands even when the original
-- movement was inserted by a non-admin (not the case today, but keeps the
-- trigger robust as we add more auto-paths later).
-- ============================================================================
create or replace function public.handle_stock_in_financial()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_batch public.stock_batches;
  v_category_id uuid;
  v_currency text;
  v_amount numeric(14,2);
begin
  if new.type <> 'stock_in' then
    return new;
  end if;

  select * into v_batch from public.stock_batches where id = new.batch_id;
  if v_batch.id is null or v_batch.cost_per_unit is null or v_batch.cost_per_unit = 0 then
    return new;
  end if;

  v_amount := round((v_batch.qty_initial * v_batch.cost_per_unit)::numeric, 2);
  if v_amount <= 0 then
    return new;
  end if;

  select id into v_category_id
    from public.transaction_categories
   where slug = 'stock_purchase'
   limit 1;

  v_currency := coalesce(
    v_batch.currency,
    (select default_currency from public.system_settings limit 1),
    'IDR'
  );

  insert into public.financial_transactions (
    type, category_id, amount, currency, transaction_date, description,
    reference_number, related_entity_type, related_entity_id,
    auto_generated, recorded_by
  ) values (
    'expense', v_category_id, v_amount, v_currency, new.moved_at::date,
    'Stock in: ' || coalesce(
      (select name from public.stock_items where id = v_batch.stock_item_id),
      'item'
    ),
    v_batch.batch_ref,
    'stock_batch', v_batch.id,
    true, new.moved_by
  );

  return new;
end;
$$;

create trigger stock_movements_autofinance
  after insert on public.stock_movements
  for each row execute function public.handle_stock_in_financial();

-- ============================================================================
-- View: monthly spending by category
-- ============================================================================
create or replace view public.finance_monthly_summary as
select
  date_trunc('month', ft.transaction_date)::date as period_month,
  ft.type,
  ft.category_id,
  c.name as category_name,
  c.slug as category_slug,
  ft.currency,
  count(*)      as txn_count,
  sum(ft.amount) as total_amount
from public.financial_transactions ft
left join public.transaction_categories c on c.id = ft.category_id
group by 1, 2, 3, 4, 5, 6;

grant select on public.finance_monthly_summary to authenticated, anon;

-- ============================================================================
-- RLS — admin-only writes; admin read full ledger.
-- Sitters can SEE categories (they appear on shared reports) but not the
-- ledger itself. This preserves the "sitters don't see financial totals"
-- rule from spec §9.4.3.
-- ============================================================================
alter table public.transaction_categories enable row level security;
alter table public.financial_transactions enable row level security;

create policy transaction_categories_select on public.transaction_categories for select
  using (public.is_active_user());
create policy transaction_categories_admin_all on public.transaction_categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy financial_transactions_admin_select on public.financial_transactions for select
  using (public.is_admin());
create policy financial_transactions_admin_all on public.financial_transactions for all
  using (public.is_admin()) with check (public.is_admin());
