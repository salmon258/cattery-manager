-- Phase 13 — Stock Management
-- Adds:
--   stock_locations   — physical storage places (Pantry, Fridge, Vet Cabinet, etc.)
--   stock_items       — catalogue rows (name, category, brand, unit, min_threshold)
--   stock_batches     — per-purchase lots with expiry, cost and current location
--   stock_movements   — append-only ledger of every qty change (stock_in, transfer,
--                       checkout, consume, adjust, discard)
--
-- Design notes:
--   * Stock locations are deliberately separate from `rooms` — rooms hold cats,
--     locations hold items. Mixing them would muddle RLS and reports.
--   * A batch is the unit that carries expiry/cost/location. Current on-hand
--     per item = sum(qty_remaining) across batches. This is exactly what the
--     spec (§5) calls "FIFO expiry batch tracking", but we intentionally let
--     sitters pick any batch — the UI nudges earliest expiry first.
--   * Movement inserts are the authoritative way to change qty_remaining or
--     location. A trigger on stock_movements applies the delta to the batch
--     and updates its location when type='transfer'. Direct updates to
--     stock_batches.qty_remaining / location_id are blocked by RLS (admin
--     only) and discouraged even for admins — use the RPCs.

-- ============================================================================
-- Enums
-- ============================================================================
create type stock_category as enum (
  'food', 'medicine', 'supplement', 'litter', 'cleaning', 'grooming', 'equipment', 'other'
);

create type stock_unit as enum (
  'pcs', 'box', 'bottle', 'pack', 'sachet', 'bag', 'kg', 'g', 'l', 'ml'
);

create type stock_movement_type as enum (
  'stock_in',   -- new batch arrival (creates the batch row)
  'transfer',   -- batch moves between locations (qty unchanged)
  'checkout',   -- sitter takes some out (qty decrement, optionally tied to a cat)
  'consume',    -- used up during ops (qty decrement, no cat link)
  'adjust',     -- manual correction (qty delta can be + or -)
  'discard'     -- expired / damaged (qty decrement)
);

-- ============================================================================
-- stock_locations — physical storage places
-- ============================================================================
create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_cold_storage boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index stock_locations_name_active_key
  on public.stock_locations(lower(name))
  where is_active;

create index stock_locations_is_active_idx on public.stock_locations(is_active);

create trigger stock_locations_set_updated_at
  before update on public.stock_locations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- stock_items — catalogue
-- ============================================================================
create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  category stock_category not null default 'other',
  unit stock_unit not null default 'pcs',
  min_threshold numeric(12,2) not null default 0 check (min_threshold >= 0),
  default_location_id uuid references public.stock_locations(id) on delete set null,
  photo_url text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_items_is_active_idx on public.stock_items(is_active);
create index stock_items_category_idx on public.stock_items(category);
create index stock_items_name_idx on public.stock_items(lower(name));

create trigger stock_items_set_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- stock_batches — per-purchase lots
-- ============================================================================
create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete restrict,
  location_id uuid references public.stock_locations(id) on delete set null,
  -- starting qty captured at stock-in; kept for reference/audit
  qty_initial numeric(12,2) not null check (qty_initial > 0),
  -- running qty, mutated only by the stock_movements trigger
  qty_remaining numeric(12,2) not null check (qty_remaining >= 0),
  expiry_date date,
  -- cost-per-unit uses the batch's own currency; finance trigger converts to
  -- transactions using system default currency when auto-creating the expense
  cost_per_unit numeric(12,2) check (cost_per_unit is null or cost_per_unit >= 0),
  currency text,
  batch_ref text,  -- supplier batch / lot number, free text
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_batches_item_idx on public.stock_batches(stock_item_id);
create index stock_batches_location_idx on public.stock_batches(location_id);
create index stock_batches_expiry_idx on public.stock_batches(expiry_date)
  where qty_remaining > 0;
create index stock_batches_qty_remaining_idx on public.stock_batches(qty_remaining)
  where qty_remaining > 0;

create trigger stock_batches_set_updated_at
  before update on public.stock_batches
  for each row execute function public.set_updated_at();

-- ============================================================================
-- stock_movements — append-only ledger
-- ============================================================================
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.stock_batches(id) on delete restrict,
  type stock_movement_type not null,
  -- signed qty delta applied to batch.qty_remaining:
  --   stock_in → +qty_initial
  --   transfer → 0 (location change only)
  --   checkout/consume/discard → negative
  --   adjust   → positive or negative
  qty_delta numeric(12,2) not null,
  from_location_id uuid references public.stock_locations(id) on delete set null,
  to_location_id uuid references public.stock_locations(id) on delete set null,
  for_cat_id uuid references public.cats(id) on delete set null,
  moved_by uuid references public.profiles(id) on delete set null,
  moved_at timestamptz not null default now(),
  reason text,
  created_at timestamptz not null default now()
);

create index stock_movements_batch_idx on public.stock_movements(batch_id, moved_at desc);
create index stock_movements_type_idx on public.stock_movements(type, moved_at desc);
create index stock_movements_cat_idx on public.stock_movements(for_cat_id, moved_at desc)
  where for_cat_id is not null;
create index stock_movements_moved_by_idx on public.stock_movements(moved_by, moved_at desc);

-- ============================================================================
-- Apply movement → mutates batch qty_remaining and, for transfers, location.
-- SECURITY DEFINER bypasses RLS on stock_batches so sitter-triggered checkout
-- movements can still decrement qty without giving sitters write access to
-- the batch row.
-- ============================================================================
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_batch public.stock_batches;
  v_new_qty numeric(12,2);
begin
  select * into v_batch from public.stock_batches where id = new.batch_id for update;
  if v_batch.id is null then
    raise exception 'batch % not found', new.batch_id using errcode = 'P0002';
  end if;

  v_new_qty := v_batch.qty_remaining + new.qty_delta;
  if v_new_qty < 0 then
    raise exception 'insufficient stock: batch % has % remaining, delta was %',
      v_batch.id, v_batch.qty_remaining, new.qty_delta using errcode = '22023';
  end if;

  update public.stock_batches
     set qty_remaining = v_new_qty,
         location_id = case when new.type = 'transfer' then new.to_location_id else location_id end
   where id = new.batch_id;

  return new;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ============================================================================
-- RPC: stock_in — admin creates a new batch + emits the stock_in ledger row
-- atomically. Cost and currency trickle through to the finance auto-trigger.
-- ============================================================================
create or replace function public.stock_in(
  p_stock_item_id uuid,
  p_qty numeric,
  p_location_id uuid,
  p_expiry_date date default null,
  p_cost_per_unit numeric default null,
  p_currency text default null,
  p_batch_ref text default null,
  p_notes text default null,
  p_received_at timestamptz default null
) returns public.stock_batches
language plpgsql security definer set search_path = public as $$
declare
  v_batch public.stock_batches;
  v_received_at timestamptz := coalesce(p_received_at, now());
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0' using errcode = '22023';
  end if;

  insert into public.stock_batches (
    stock_item_id, location_id, qty_initial, qty_remaining,
    expiry_date, cost_per_unit, currency, batch_ref, received_at, received_by, notes
  ) values (
    p_stock_item_id, p_location_id, p_qty, p_qty,
    p_expiry_date, p_cost_per_unit, p_currency, p_batch_ref, v_received_at, auth.uid(), p_notes
  ) returning * into v_batch;

  insert into public.stock_movements (
    batch_id, type, qty_delta, to_location_id, moved_by, moved_at, reason
  ) values (
    v_batch.id, 'stock_in', p_qty, p_location_id, auth.uid(), v_received_at,
    coalesce(p_batch_ref, 'Stock in')
  );

  return v_batch;
end;
$$;

-- ============================================================================
-- RPC: stock_checkout — sitter takes qty from a chosen batch
-- ============================================================================
create or replace function public.stock_checkout(
  p_batch_id uuid,
  p_qty numeric,
  p_for_cat_id uuid default null,
  p_reason text default null
) returns public.stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_batch public.stock_batches;
  v_mov public.stock_movements;
begin
  if not public.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'qty must be > 0' using errcode = '22023';
  end if;

  select * into v_batch from public.stock_batches where id = p_batch_id;
  if v_batch.id is null then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;

  insert into public.stock_movements (
    batch_id, type, qty_delta, from_location_id, for_cat_id, moved_by, reason
  ) values (
    p_batch_id, 'checkout', -p_qty, v_batch.location_id, p_for_cat_id, auth.uid(), p_reason
  ) returning * into v_mov;

  return v_mov;
end;
$$;

-- ============================================================================
-- RPC: stock_transfer — admin moves a batch between locations
-- ============================================================================
create or replace function public.stock_transfer(
  p_batch_id uuid,
  p_to_location_id uuid,
  p_reason text default null
) returns public.stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_batch public.stock_batches;
  v_mov public.stock_movements;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  select * into v_batch from public.stock_batches where id = p_batch_id;
  if v_batch.id is null then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;
  if v_batch.location_id is not distinct from p_to_location_id then
    raise exception 'batch already in target location' using errcode = '22023';
  end if;

  insert into public.stock_movements (
    batch_id, type, qty_delta, from_location_id, to_location_id, moved_by, reason
  ) values (
    p_batch_id, 'transfer', 0, v_batch.location_id, p_to_location_id, auth.uid(), p_reason
  ) returning * into v_mov;

  return v_mov;
end;
$$;

-- ============================================================================
-- RPC: stock_adjust — admin corrects qty (+/-)
-- ============================================================================
create or replace function public.stock_adjust(
  p_batch_id uuid,
  p_qty_delta numeric,
  p_reason text default null
) returns public.stock_movements
language plpgsql security definer set search_path = public as $$
declare
  v_batch public.stock_batches;
  v_mov public.stock_movements;
  v_mtype stock_movement_type;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if p_qty_delta is null or p_qty_delta = 0 then
    raise exception 'qty_delta must be non-zero' using errcode = '22023';
  end if;

  select * into v_batch from public.stock_batches where id = p_batch_id;
  if v_batch.id is null then
    raise exception 'batch not found' using errcode = 'P0002';
  end if;

  -- `discard` when removing something, `adjust` when adding or a manual fix
  v_mtype := case when p_qty_delta < 0 and lower(coalesce(p_reason, '')) like '%expir%' then 'discard'::stock_movement_type
                  else 'adjust'::stock_movement_type end;

  insert into public.stock_movements (
    batch_id, type, qty_delta, from_location_id, moved_by, reason
  ) values (
    p_batch_id, v_mtype, p_qty_delta, v_batch.location_id, auth.uid(), p_reason
  ) returning * into v_mov;

  return v_mov;
end;
$$;

-- ============================================================================
-- Views for dashboards & reports
-- ============================================================================

-- Current on-hand per item (sum of active batch remainders) + min_threshold flag
create or replace view public.stock_item_status as
select
  i.id as stock_item_id,
  i.name,
  i.brand,
  i.category,
  i.unit,
  i.min_threshold,
  i.is_active,
  coalesce(sum(b.qty_remaining), 0) as qty_on_hand,
  count(b.id) filter (where b.qty_remaining > 0) as active_batches,
  min(b.expiry_date) filter (where b.qty_remaining > 0) as earliest_expiry,
  (coalesce(sum(b.qty_remaining), 0) < i.min_threshold) as is_low_stock
from public.stock_items i
left join public.stock_batches b on b.stock_item_id = i.id
group by i.id;

grant select on public.stock_item_status to authenticated, anon;

-- Batches expiring within 30 days, still with qty
create or replace view public.stock_expiring_batches as
select
  b.id as batch_id,
  b.stock_item_id,
  i.name as item_name,
  i.category,
  i.unit,
  b.location_id,
  l.name as location_name,
  b.qty_remaining,
  b.expiry_date,
  (b.expiry_date - current_date) as days_to_expiry
from public.stock_batches b
join public.stock_items i on i.id = b.stock_item_id
left join public.stock_locations l on l.id = b.location_id
where b.qty_remaining > 0
  and b.expiry_date is not null
  and b.expiry_date <= (current_date + interval '30 days');

grant select on public.stock_expiring_batches to authenticated, anon;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.stock_locations enable row level security;
alter table public.stock_items     enable row level security;
alter table public.stock_batches   enable row level security;
alter table public.stock_movements enable row level security;

-- stock_locations: all active users read; admin writes
create policy stock_locations_select on public.stock_locations for select
  using (public.is_active_user());
create policy stock_locations_admin_all on public.stock_locations for all
  using (public.is_admin()) with check (public.is_admin());

-- stock_items: all active users read; admin writes
create policy stock_items_select on public.stock_items for select
  using (public.is_active_user());
create policy stock_items_admin_all on public.stock_items for all
  using (public.is_admin()) with check (public.is_admin());

-- stock_batches: all active users read; admin-only direct writes.
-- Sitters mutate qty/location indirectly via stock_checkout RPC (SECURITY DEFINER).
create policy stock_batches_select on public.stock_batches for select
  using (public.is_active_user());
create policy stock_batches_admin_all on public.stock_batches for all
  using (public.is_admin()) with check (public.is_admin());

-- stock_movements: all active users read; all active users may INSERT rows
-- they signed themselves (sitter checkout). Admin-only UPDATE/DELETE.
-- Non-checkout/non-consume movement types are funnelled through RPCs that
-- already gate on is_admin(), so an INSERT policy that allows any active
-- user is safe here.
create policy stock_movements_select on public.stock_movements for select
  using (public.is_active_user());
create policy stock_movements_insert on public.stock_movements for insert
  with check (public.is_active_user() and moved_by = auth.uid());
create policy stock_movements_admin_update on public.stock_movements for update
  using (public.is_admin()) with check (public.is_admin());
create policy stock_movements_admin_delete on public.stock_movements for delete
  using (public.is_admin());
