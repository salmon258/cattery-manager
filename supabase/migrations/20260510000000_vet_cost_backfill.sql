-- Phase 14 follow-up — Vet cost/transport backfill.
--
-- The original Phase 14 migration (20260509000000) attempted to seed
-- financial_transactions for visits that already had a visit_cost /
-- transport_cost by writing the same values back onto the row. That fails
-- silently because the vet_visits_autofinance_upd trigger has an
-- `WHEN (new.* IS DISTINCT FROM old.*)` guard — writing a value back onto
-- itself is NOT distinct, so the trigger body never runs.
--
-- This migration fixes it with a direct insert into the ledger, guarded
-- by a NOT EXISTS so it is idempotent on databases that already got some
-- rows through other paths (e.g. edits made after Phase 14 shipped).
--
-- Safe to re-run; will only ever add missing rows.

-- Visit cost -> Expense | Vet & Medical
insert into public.financial_transactions (
  type, category_id, amount, currency, transaction_date, description,
  related_entity_type, related_entity_id, auto_generated, recorded_by
)
select
  'expense',
  (select id from public.transaction_categories where slug = 'vet_medical' limit 1),
  v.visit_cost,
  coalesce((select default_currency from public.system_settings limit 1), 'IDR'),
  v.visit_date,
  'Vet visit: ' || coalesce(c.name, 'cat')
    || ' — ' || coalesce(v.visit_type::text, 'visit')
    || ' (' || v.visit_date::text || ')',
  'vet_visit', v.id, true, v.created_by
from public.vet_visits v
left join public.cats c on c.id = v.cat_id
where coalesce(v.visit_cost, 0) > 0
  and not exists (
    select 1
    from public.financial_transactions ft
    where ft.related_entity_type = 'vet_visit'
      and ft.related_entity_id   = v.id
      and ft.category_id = (
        select id from public.transaction_categories where slug = 'vet_medical' limit 1
      )
  );

-- Transport cost -> Expense | Transport
insert into public.financial_transactions (
  type, category_id, amount, currency, transaction_date, description,
  related_entity_type, related_entity_id, auto_generated, recorded_by
)
select
  'expense',
  (select id from public.transaction_categories where slug = 'transport' limit 1),
  v.transport_cost,
  coalesce((select default_currency from public.system_settings limit 1), 'IDR'),
  v.visit_date,
  'Vet transport: ' || coalesce(c.name, 'cat')
    || ' — ' || coalesce(v.visit_type::text, 'visit')
    || ' (' || v.visit_date::text || ')',
  'vet_visit', v.id, true, v.created_by
from public.vet_visits v
left join public.cats c on c.id = v.cat_id
where coalesce(v.transport_cost, 0) > 0
  and not exists (
    select 1
    from public.financial_transactions ft
    where ft.related_entity_type = 'vet_visit'
      and ft.related_entity_id   = v.id
      and ft.category_id = (
        select id from public.transaction_categories where slug = 'transport' limit 1
      )
  );
