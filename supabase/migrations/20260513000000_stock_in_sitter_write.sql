-- Allow cat sitters to add items to stock, not just admins. Two things change:
--   1. Sitters can INSERT new catalogue rows (stock_items) via a new RLS policy.
--      Updates/deletes stay admin-only through the existing admin_all policy.
--   2. The stock_in RPC, which previously gated on is_admin(), now gates on
--      is_active_user() so sitters can record a delivery when the admin isn't
--      around. Direct writes on stock_batches stay admin-only via RLS — sitters
--      must go through the RPC, which runs SECURITY DEFINER and validates qty.

-- ---- stock_items INSERT for any active user ----
create policy stock_items_active_insert on public.stock_items
  for insert to authenticated
  with check (public.is_active_user() and created_by = auth.uid());

-- ---- stock_in RPC: admin-only → any active user ----

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
  if not public.is_active_user() then
    raise exception 'forbidden: active account required' using errcode = '42501';
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
