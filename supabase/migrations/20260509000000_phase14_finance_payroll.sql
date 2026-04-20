-- Phase 14 — Finance & Payroll (full)
--
-- Builds on the Phase 13 foundation (`transaction_categories`,
-- `financial_transactions`, stock-in auto-trigger). Adds:
--
--   * profile_salaries    — per-sitter base salary with effective-from history
--   * payroll_entries     — per-period payout (gross, bonus, deduction, net)
--   * Auto-trigger: payroll paid  -> Expense | Staff Payroll
--   * Auto-trigger: vet_visit cost/transport -> Expense | Vet & Medical / Transport
--   * Storage bucket:   `finance-attachments` (receipts + transfer proofs)
--   * View: `finance_payroll_status` for quick period lookups
--
-- What is intentionally NOT included:
--   * Adoption records trigger — the `adoption_records` table does not yet
--     exist (Phase 1 `cats` table has no adoption fields). When an adoption
--     phase lands, the same `related_entity_type='adoption'` slot on
--     `financial_transactions` will be used; seed category `adoption_fee`
--     already exists from Phase 13.
--
-- Auto-triggers use SECURITY DEFINER so the insert into
-- `financial_transactions` succeeds regardless of the caller's RLS.

-- ============================================================================
-- profile_salaries
-- ============================================================================
create table public.profile_salaries (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  monthly_salary  numeric(14,2) not null check (monthly_salary >= 0),
  currency        text not null,
  effective_from  date not null default current_date,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profile_salaries_profile_idx
  on public.profile_salaries(profile_id, effective_from desc);

create trigger profile_salaries_set_updated_at
  before update on public.profile_salaries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- payroll_entries
-- ============================================================================
create type public.payroll_status as enum ('pending', 'paid', 'cancelled');

create table public.payroll_entries (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete restrict,
  period_start          date not null,
  period_end            date not null,
  gross_amount          numeric(14,2) not null check (gross_amount >= 0),
  bonus_amount          numeric(14,2) not null default 0 check (bonus_amount >= 0),
  deduction_amount      numeric(14,2) not null default 0 check (deduction_amount >= 0),
  -- net_amount is stored (not generated) so admins can override if needed.
  net_amount            numeric(14,2) not null check (net_amount >= 0),
  currency              text not null,
  status                public.payroll_status not null default 'pending',
  payment_date          date,
  payment_method        public.financial_payment_method,
  transfer_proof_url    text,
  transfer_proof_path   text,
  reference_number      text,
  notes                 text,
  financial_txn_id      uuid references public.financial_transactions(id) on delete set null,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint payroll_entries_period_valid check (period_end >= period_start),
  constraint payroll_entries_paid_requires_date
    check (status <> 'paid' or payment_date is not null),
  -- Prevent accidentally creating two rows for the same person/period.
  constraint payroll_entries_unique_period
    unique (profile_id, period_start, period_end)
);

create index payroll_entries_profile_idx
  on public.payroll_entries(profile_id, period_start desc);
create index payroll_entries_status_idx
  on public.payroll_entries(status);

create trigger payroll_entries_set_updated_at
  before update on public.payroll_entries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-trigger: when a payroll_entry flips to 'paid', create the Expense
-- transaction under "Staff Payroll" (or update the existing one if the amount
-- changed before it flipped). Idempotent — never duplicates a row.
-- ============================================================================
create or replace function public.handle_payroll_financial()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_category_id uuid;
  v_txn_id uuid;
  v_profile_name text;
begin
  if new.status <> 'paid' then
    -- Moved away from paid? Leave the ledger row alone (history preserved)
    -- but unlink so future 'paid' transitions create a fresh row.
    if old is not null and old.status = 'paid' and new.status <> 'paid' then
      update public.payroll_entries
        set financial_txn_id = null
        where id = new.id;
    end if;
    return new;
  end if;

  select id into v_category_id
    from public.transaction_categories
   where slug = 'staff_payroll'
   limit 1;

  select full_name into v_profile_name
    from public.profiles
   where id = new.profile_id;

  if new.financial_txn_id is not null then
    -- Keep an already-linked row in sync with the current payroll values.
    update public.financial_transactions
       set amount           = new.net_amount,
           currency         = new.currency,
           transaction_date = new.payment_date,
           payment_method   = new.payment_method,
           reference_number = new.reference_number,
           receipt_url      = new.transfer_proof_url,
           description      = 'Payroll: ' || coalesce(v_profile_name, 'staff')
                              || ' (' || new.period_start::text
                              || ' → ' || new.period_end::text || ')'
     where id = new.financial_txn_id;
  else
    insert into public.financial_transactions (
      type, category_id, amount, currency, transaction_date, description,
      reference_number, receipt_url,
      related_entity_type, related_entity_id,
      payment_method, auto_generated, recorded_by
    ) values (
      'expense', v_category_id, new.net_amount, new.currency,
      new.payment_date,
      'Payroll: ' || coalesce(v_profile_name, 'staff')
        || ' (' || new.period_start::text || ' → ' || new.period_end::text || ')',
      new.reference_number, new.transfer_proof_url,
      'payroll', new.id,
      new.payment_method, true, new.created_by
    ) returning id into v_txn_id;

    update public.payroll_entries
       set financial_txn_id = v_txn_id
       where id = new.id;
  end if;

  return new;
end;
$$;

create trigger payroll_entries_autofinance_ins
  after insert on public.payroll_entries
  for each row execute function public.handle_payroll_financial();

create trigger payroll_entries_autofinance_upd
  after update on public.payroll_entries
  for each row
  when (
    new.status is distinct from old.status
    or new.net_amount is distinct from old.net_amount
    or new.payment_date is distinct from old.payment_date
    or new.payment_method is distinct from old.payment_method
    or new.transfer_proof_url is distinct from old.transfer_proof_url
    or new.reference_number is distinct from old.reference_number
  )
  execute function public.handle_payroll_financial();

-- ============================================================================
-- Auto-trigger: vet_visits visit_cost/transport_cost -> Expense rows.
-- One row per cost type; linked back via related_entity_type='vet_visit'.
-- Edits to the visit (cost changes) sync the linked ledger rows.
-- Deleting a visit cascades the visit row; ledger rows are kept for history
-- (the related_entity_id is preserved, they simply become orphaned).
-- ============================================================================
create or replace function public.handle_vet_visit_financial()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_vet_cat_id       uuid;
  v_transport_cat_id uuid;
  v_currency         text;
  v_cat_name         text;
  v_visit_desc       text;
  v_existing_vet_id       uuid;
  v_existing_transport_id uuid;
begin
  v_currency := coalesce(
    (select default_currency from public.system_settings limit 1),
    'IDR'
  );

  select id into v_vet_cat_id
    from public.transaction_categories where slug = 'vet_medical' limit 1;
  select id into v_transport_cat_id
    from public.transaction_categories where slug = 'transport' limit 1;

  select name into v_cat_name from public.cats where id = new.cat_id;
  v_visit_desc := coalesce(v_cat_name, 'cat')
                || ' — ' || coalesce(new.visit_type::text, 'visit')
                || ' (' || new.visit_date::text || ')';

  -- Find existing auto rows so we update rather than duplicate on visit edits.
  select id into v_existing_vet_id
    from public.financial_transactions
   where related_entity_type = 'vet_visit'
     and related_entity_id   = new.id
     and category_id         = v_vet_cat_id
     and auto_generated = true
   limit 1;
  select id into v_existing_transport_id
    from public.financial_transactions
   where related_entity_type = 'vet_visit'
     and related_entity_id   = new.id
     and category_id         = v_transport_cat_id
     and auto_generated = true
   limit 1;

  -- Visit cost
  if coalesce(new.visit_cost, 0) > 0 then
    if v_existing_vet_id is null then
      insert into public.financial_transactions (
        type, category_id, amount, currency, transaction_date, description,
        related_entity_type, related_entity_id, auto_generated, recorded_by
      ) values (
        'expense', v_vet_cat_id, new.visit_cost, v_currency, new.visit_date,
        'Vet visit: ' || v_visit_desc,
        'vet_visit', new.id, true, new.created_by
      );
    else
      update public.financial_transactions
         set amount = new.visit_cost,
             transaction_date = new.visit_date,
             description = 'Vet visit: ' || v_visit_desc
       where id = v_existing_vet_id;
    end if;
  elsif v_existing_vet_id is not null then
    -- Cost dropped to 0/null — remove the stale auto row so the ledger stays truthful.
    delete from public.financial_transactions where id = v_existing_vet_id;
  end if;

  -- Transport cost
  if coalesce(new.transport_cost, 0) > 0 then
    if v_existing_transport_id is null then
      insert into public.financial_transactions (
        type, category_id, amount, currency, transaction_date, description,
        related_entity_type, related_entity_id, auto_generated, recorded_by
      ) values (
        'expense', v_transport_cat_id, new.transport_cost, v_currency, new.visit_date,
        'Vet transport: ' || v_visit_desc,
        'vet_visit', new.id, true, new.created_by
      );
    else
      update public.financial_transactions
         set amount = new.transport_cost,
             transaction_date = new.visit_date,
             description = 'Vet transport: ' || v_visit_desc
       where id = v_existing_transport_id;
    end if;
  elsif v_existing_transport_id is not null then
    delete from public.financial_transactions where id = v_existing_transport_id;
  end if;

  return new;
end;
$$;

create trigger vet_visits_autofinance_ins
  after insert on public.vet_visits
  for each row execute function public.handle_vet_visit_financial();

create trigger vet_visits_autofinance_upd
  after update on public.vet_visits
  for each row
  when (
    new.visit_cost     is distinct from old.visit_cost
    or new.transport_cost is distinct from old.transport_cost
    or new.visit_date     is distinct from old.visit_date
    or new.cat_id         is distinct from old.cat_id
  )
  execute function public.handle_vet_visit_financial();

-- Backfill vet costs that were captured before this phase shipped.
do $$
declare r record;
begin
  for r in
    select id, cat_id, visit_date, visit_cost, transport_cost, visit_type, created_by
      from public.vet_visits
     where (coalesce(visit_cost,0) > 0 or coalesce(transport_cost,0) > 0)
  loop
    -- Re-run the trigger body by issuing a no-op touch update; the WHEN
    -- clause gates on a change in any of the tracked columns, so we nudge
    -- visit_date to itself to bypass it, then set it back.
    update public.vet_visits
       set visit_cost = r.visit_cost,
           transport_cost = r.transport_cost
     where id = r.id
       and not exists (
         select 1 from public.financial_transactions
          where related_entity_type='vet_visit' and related_entity_id = r.id
       );
  end loop;
end$$;

-- ============================================================================
-- View: payroll status for the admin dashboard / payroll page
-- ============================================================================
create or replace view public.finance_payroll_status as
select
  pe.id,
  pe.profile_id,
  p.full_name as profile_name,
  pe.period_start,
  pe.period_end,
  pe.gross_amount,
  pe.bonus_amount,
  pe.deduction_amount,
  pe.net_amount,
  pe.currency,
  pe.status,
  pe.payment_date,
  pe.payment_method,
  pe.transfer_proof_url,
  pe.financial_txn_id,
  pe.created_at
from public.payroll_entries pe
left join public.profiles p on p.id = pe.profile_id;

grant select on public.finance_payroll_status to authenticated, anon;

-- ============================================================================
-- RLS
--
-- profile_salaries:
--   * Admin: full CRUD
--   * Owner: select own rows (read-only; admin sets salaries)
-- payroll_entries:
--   * Admin: full CRUD
--   * Owner: select own rows (for "My Payroll" page)
-- ============================================================================
alter table public.profile_salaries enable row level security;
alter table public.payroll_entries  enable row level security;

create policy profile_salaries_admin_all on public.profile_salaries for all
  using (public.is_admin()) with check (public.is_admin());
create policy profile_salaries_select_self on public.profile_salaries for select
  using (profile_id = auth.uid());

create policy payroll_entries_admin_all on public.payroll_entries for all
  using (public.is_admin()) with check (public.is_admin());
create policy payroll_entries_select_self on public.payroll_entries for select
  using (profile_id = auth.uid());

-- ============================================================================
-- Storage bucket: finance-attachments
--
-- Holds both manual transaction receipts and payroll transfer proofs.
-- The bucket is kept PRIVATE (public=false) — files are served via signed
-- URLs from the API route, so sitters can only fetch their own payroll
-- proofs. Admins can fetch anything.
--
-- Path conventions:
--   payroll/{payroll_entry_id}/{filename}
--   receipts/{transaction_id or temp}/{filename}
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('finance-attachments', 'finance-attachments', false);

create policy "finance_attachments_select_admin"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'finance-attachments' and public.is_admin());

-- Owners of a payroll row may read their own transfer proof: we can't
-- cheaply check ownership in object-level RLS (we'd need the storage path
-- to carry the profile id). Instead, the API fetches the signed URL with
-- the service-role key for the owner and streams it back — no public read
-- policy is needed. See app/api/finance/payroll/[id]/proof/route.ts.

create policy "finance_attachments_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'finance-attachments' and public.is_admin());

create policy "finance_attachments_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'finance-attachments' and public.is_admin());

create policy "finance_attachments_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'finance-attachments' and public.is_admin());
