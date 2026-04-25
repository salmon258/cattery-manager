-- Phase 14b — Reimbursements & ad-hoc payments
--
-- Builds on Phase 14 payroll. Adds two parallel flows that both surface on a
-- sitter's "My Payroll" page and on the admin payroll page, and that drop a
-- linked row in `financial_transactions` once paid:
--
--   * reimbursement_categories  — admin-configurable list (transport, food,
--     medicine, doctor, …). Each category may map to a `transaction_categories`
--     entry so the auto-generated finance row lands in the right bucket
--     (e.g. transport reimbursement → "Transport" expense, not "Staff Payroll").
--
--   * reimbursement_requests    — sitter proposes; admin approves/rejects;
--     once paid (admin attaches transfer proof), an Expense row is auto-created.
--
--   * adhoc_payments            — admin-added one-off payouts (meal, overtime,
--     bonus, …). Always linked to a sitter; once paid, drops an Expense row.
--
-- Storage:
--   The existing `finance-attachments` bucket is reused. New path conventions:
--     reimbursements/{request_id}/receipt-…       (sitter-uploaded screenshot)
--     reimbursements/{request_id}/payment-…       (admin-uploaded transfer proof)
--     adhoc/{payment_id}/payment-…                (admin-uploaded transfer proof)
--   Sitters never write directly to storage — they POST multipart to the API
--   route, which uses the service-role client to upload. This avoids the
--   path-prefix RLS dance and keeps the bucket admin-only at the row level.

-- ============================================================================
-- reimbursement_categories
-- ============================================================================
create table public.reimbursement_categories (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique,
  icon                text,
  -- When set, the auto-generated financial_transactions row is filed under
  -- this expense category instead of the default 'staff_payroll' bucket.
  finance_category_id uuid references public.transaction_categories(id) on delete set null,
  sort_order          int  not null default 0,
  is_active           boolean not null default true,
  is_system           boolean not null default false,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index reimbursement_categories_name_active_key
  on public.reimbursement_categories(lower(name))
  where is_active;

create trigger reimbursement_categories_set_updated_at
  before update on public.reimbursement_categories
  for each row execute function public.set_updated_at();

-- Seed defaults — slugs are stable for lookup, finance_category_id is filled
-- by name-match against transaction_categories so seeding remains idempotent
-- across environments where IDs differ.
insert into public.reimbursement_categories (name, slug, sort_order, is_system, finance_category_id)
values
  ('Transport',       'transport',       10, true,
    (select id from public.transaction_categories where slug = 'transport' limit 1)),
  ('Food',            'food',            20, true,
    (select id from public.transaction_categories where slug = 'food_supplies' limit 1)),
  ('Medicine',        'medicine',        30, true,
    (select id from public.transaction_categories where slug = 'medicine_vitamins' limit 1)),
  ('Doctor / Vet',    'doctor',          40, true,
    (select id from public.transaction_categories where slug = 'vet_medical' limit 1)),
  ('Supplies',        'supplies',        50, true,
    (select id from public.transaction_categories where slug = 'equipment' limit 1)),
  ('Other',           'other',          990, true,
    (select id from public.transaction_categories where slug = 'other_expense' limit 1));

-- ============================================================================
-- reimbursement_requests
-- ============================================================================
create type public.reimbursement_status as enum (
  'pending', 'approved', 'rejected', 'paid', 'cancelled'
);

create table public.reimbursement_requests (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  category_id           uuid references public.reimbursement_categories(id) on delete set null,
  amount                numeric(14,2) not null check (amount >= 0),
  currency              text not null,
  expense_date          date not null,
  description           text,

  -- Receipt screenshot uploaded by the sitter when proposing.
  receipt_url           text,
  receipt_path          text,

  status                public.reimbursement_status not null default 'pending',

  -- Review (admin)
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  review_notes          text,

  -- Payment (admin) — only meaningful after approval.
  payment_date          date,
  payment_method        public.financial_payment_method,
  payment_reference     text,
  payment_proof_url     text,
  payment_proof_path    text,

  -- Linked finance row, populated automatically once paid.
  financial_txn_id      uuid references public.financial_transactions(id) on delete set null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint reimbursement_paid_requires_review
    check (status not in ('paid') or reviewed_at is not null),
  constraint reimbursement_paid_requires_date
    check (status <> 'paid' or payment_date is not null)
);

create index reimbursement_requests_profile_idx
  on public.reimbursement_requests(profile_id, expense_date desc);
create index reimbursement_requests_status_idx
  on public.reimbursement_requests(status);
create index reimbursement_requests_category_idx
  on public.reimbursement_requests(category_id);

create trigger reimbursement_requests_set_updated_at
  before update on public.reimbursement_requests
  for each row execute function public.set_updated_at();

-- ============================================================================
-- adhoc_payments
-- ============================================================================
create type public.adhoc_payment_status as enum ('pending', 'paid', 'cancelled');

create table public.adhoc_payments (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete restrict,
  -- Free-form label shown to the sitter (e.g. 'Meal', 'Overtime'). Kept as
  -- text so admins don't need to manage another category table just for this.
  kind                  text not null,
  -- Optional finance category override; defaults to 'staff_payroll' in trigger.
  finance_category_id   uuid references public.transaction_categories(id) on delete set null,
  amount                numeric(14,2) not null check (amount >= 0),
  currency              text not null,
  payment_date          date not null default current_date,
  description           text,

  status                public.adhoc_payment_status not null default 'pending',

  payment_method        public.financial_payment_method,
  payment_reference     text,
  payment_proof_url     text,
  payment_proof_path    text,

  financial_txn_id      uuid references public.financial_transactions(id) on delete set null,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint adhoc_payments_paid_requires_date
    check (status <> 'paid' or payment_date is not null)
);

create index adhoc_payments_profile_idx
  on public.adhoc_payments(profile_id, payment_date desc);
create index adhoc_payments_status_idx
  on public.adhoc_payments(status);

create trigger adhoc_payments_set_updated_at
  before update on public.adhoc_payments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-trigger: reimbursement → financial_transactions when paid
-- We use related_entity_type = 'other' (the existing enum) and stash the
-- request id in related_entity_id so we can sync/unlink later.
-- ============================================================================
create or replace function public.handle_reimbursement_financial()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_category_id uuid;
  v_fallback_id uuid;
  v_profile_name text;
  v_cat_name text;
  v_txn_id uuid;
begin
  if new.status <> 'paid' then
    -- Moving away from paid? unlink so the next 'paid' transition creates fresh.
    if old is not null and old.status = 'paid' and new.status <> 'paid' then
      update public.reimbursement_requests
         set financial_txn_id = null
       where id = new.id;
    end if;
    return new;
  end if;

  select rc.finance_category_id, rc.name
    into v_category_id, v_cat_name
    from public.reimbursement_categories rc
   where rc.id = new.category_id;

  if v_category_id is null then
    select id into v_fallback_id
      from public.transaction_categories
     where slug = 'staff_payroll' limit 1;
    v_category_id := v_fallback_id;
  end if;

  select full_name into v_profile_name
    from public.profiles where id = new.profile_id;

  if new.financial_txn_id is not null then
    update public.financial_transactions
       set amount           = new.amount,
           currency         = new.currency,
           transaction_date = new.payment_date,
           payment_method   = new.payment_method,
           reference_number = new.payment_reference,
           receipt_url      = coalesce(new.payment_proof_url, new.receipt_url),
           category_id      = v_category_id,
           description      = 'Reimbursement: '
                              || coalesce(v_profile_name, 'staff')
                              || coalesce(' — ' || v_cat_name, '')
                              || coalesce(' · ' || new.description, '')
     where id = new.financial_txn_id;
  else
    insert into public.financial_transactions (
      type, category_id, amount, currency, transaction_date,
      description, reference_number, receipt_url,
      related_entity_type, related_entity_id,
      payment_method, auto_generated, recorded_by
    ) values (
      'expense', v_category_id, new.amount, new.currency, new.payment_date,
      'Reimbursement: '
        || coalesce(v_profile_name, 'staff')
        || coalesce(' — ' || v_cat_name, '')
        || coalesce(' · ' || new.description, ''),
      new.payment_reference,
      coalesce(new.payment_proof_url, new.receipt_url),
      'other', new.id,
      new.payment_method, true, coalesce(new.reviewed_by, new.profile_id)
    ) returning id into v_txn_id;

    update public.reimbursement_requests
       set financial_txn_id = v_txn_id
     where id = new.id;
  end if;

  return new;
end;
$$;

create trigger reimbursement_requests_autofinance_ins
  after insert on public.reimbursement_requests
  for each row execute function public.handle_reimbursement_financial();

create trigger reimbursement_requests_autofinance_upd
  after update on public.reimbursement_requests
  for each row
  when (
    new.status            is distinct from old.status
    or new.amount         is distinct from old.amount
    or new.currency       is distinct from old.currency
    or new.payment_date   is distinct from old.payment_date
    or new.payment_method is distinct from old.payment_method
    or new.payment_reference is distinct from old.payment_reference
    or new.payment_proof_url is distinct from old.payment_proof_url
    or new.category_id    is distinct from old.category_id
    or new.description    is distinct from old.description
  )
  execute function public.handle_reimbursement_financial();

-- ============================================================================
-- Auto-trigger: adhoc_payments → financial_transactions when paid
-- Uses 'staff_payroll' as the default expense category; admin can override
-- per-row via finance_category_id.
-- ============================================================================
create or replace function public.handle_adhoc_payment_financial()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_category_id uuid;
  v_fallback_id uuid;
  v_profile_name text;
  v_txn_id uuid;
begin
  if new.status <> 'paid' then
    if old is not null and old.status = 'paid' and new.status <> 'paid' then
      update public.adhoc_payments
         set financial_txn_id = null
       where id = new.id;
    end if;
    return new;
  end if;

  v_category_id := new.finance_category_id;
  if v_category_id is null then
    select id into v_fallback_id
      from public.transaction_categories
     where slug = 'staff_payroll' limit 1;
    v_category_id := v_fallback_id;
  end if;

  select full_name into v_profile_name
    from public.profiles where id = new.profile_id;

  if new.financial_txn_id is not null then
    update public.financial_transactions
       set amount           = new.amount,
           currency         = new.currency,
           transaction_date = new.payment_date,
           payment_method   = new.payment_method,
           reference_number = new.payment_reference,
           receipt_url      = new.payment_proof_url,
           category_id      = v_category_id,
           description      = new.kind
                              || ' — ' || coalesce(v_profile_name, 'staff')
                              || coalesce(' · ' || new.description, '')
     where id = new.financial_txn_id;
  else
    insert into public.financial_transactions (
      type, category_id, amount, currency, transaction_date,
      description, reference_number, receipt_url,
      related_entity_type, related_entity_id,
      payment_method, auto_generated, recorded_by
    ) values (
      'expense', v_category_id, new.amount, new.currency, new.payment_date,
      new.kind || ' — ' || coalesce(v_profile_name, 'staff')
        || coalesce(' · ' || new.description, ''),
      new.payment_reference,
      new.payment_proof_url,
      'other', new.id,
      new.payment_method, true, coalesce(new.created_by, new.profile_id)
    ) returning id into v_txn_id;

    update public.adhoc_payments
       set financial_txn_id = v_txn_id
     where id = new.id;
  end if;

  return new;
end;
$$;

create trigger adhoc_payments_autofinance_ins
  after insert on public.adhoc_payments
  for each row execute function public.handle_adhoc_payment_financial();

create trigger adhoc_payments_autofinance_upd
  after update on public.adhoc_payments
  for each row
  when (
    new.status            is distinct from old.status
    or new.amount         is distinct from old.amount
    or new.currency       is distinct from old.currency
    or new.payment_date   is distinct from old.payment_date
    or new.payment_method is distinct from old.payment_method
    or new.payment_reference is distinct from old.payment_reference
    or new.payment_proof_url is distinct from old.payment_proof_url
    or new.finance_category_id is distinct from old.finance_category_id
    or new.kind           is distinct from old.kind
    or new.description    is distinct from old.description
  )
  execute function public.handle_adhoc_payment_financial();

-- ============================================================================
-- RLS
--
-- reimbursement_categories:
--   * Anyone authenticated can SELECT (sitters need to pick categories)
--   * Admin: full CRUD
-- reimbursement_requests:
--   * Sitter: insert own (profile_id = auth.uid()) while pending; select own;
--             update own only while status='pending' (cancel + edits);
--             delete own while pending.
--   * Admin: full CRUD
-- adhoc_payments:
--   * Admin: full CRUD
--   * Owner sitter: select own (read-only)
-- ============================================================================
alter table public.reimbursement_categories enable row level security;
alter table public.reimbursement_requests   enable row level security;
alter table public.adhoc_payments           enable row level security;

create policy reimbursement_categories_select on public.reimbursement_categories
  for select using (public.is_active_user());
create policy reimbursement_categories_admin_all on public.reimbursement_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy reimbursement_requests_admin_all on public.reimbursement_requests
  for all using (public.is_admin()) with check (public.is_admin());
create policy reimbursement_requests_select_own on public.reimbursement_requests
  for select using (profile_id = auth.uid());
create policy reimbursement_requests_insert_own on public.reimbursement_requests
  for insert with check (
    profile_id = auth.uid() and status = 'pending'
  );
create policy reimbursement_requests_update_own_pending on public.reimbursement_requests
  for update using (
    profile_id = auth.uid() and status = 'pending'
  ) with check (
    -- A sitter can only keep their row pending; status changes are admin-only.
    profile_id = auth.uid() and status in ('pending', 'cancelled')
  );
create policy reimbursement_requests_delete_own_pending on public.reimbursement_requests
  for delete using (
    profile_id = auth.uid() and status = 'pending'
  );

create policy adhoc_payments_admin_all on public.adhoc_payments
  for all using (public.is_admin()) with check (public.is_admin());
create policy adhoc_payments_select_own on public.adhoc_payments
  for select using (profile_id = auth.uid());
