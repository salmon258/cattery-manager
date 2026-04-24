-- Fix stock_in double-count: qty_remaining was ending up at 2× qty_initial
-- (e.g. stocking in 24 units showed 48/24 on the batch row, total on-hand 48).
--
-- The original RPC inserted the batch row with qty_remaining = p_qty, then
-- inserted a stock_movements row with qty_delta = p_qty. The apply_stock_movement
-- AFTER INSERT trigger then added qty_delta back onto qty_remaining, doubling it.
--
-- Fix: seed the batch with qty_remaining = 0 and let the trigger drive the
-- remaining qty through the ledger, the same way every other movement type does.
--
-- Backfill: reset every existing batch's qty_remaining to the sum of its
-- movement deltas — that's the invariant the ledger is supposed to uphold, so
-- this self-heals batches that got inflated by the bug while leaving
-- correctly-accounted batches untouched (sum already matches).

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
    p_stock_item_id, p_location_id, p_qty, 0,
    p_expiry_date, p_cost_per_unit, p_currency, p_batch_ref, v_received_at, auth.uid(), p_notes
  ) returning * into v_batch;

  insert into public.stock_movements (
    batch_id, type, qty_delta, to_location_id, moved_by, moved_at, reason
  ) values (
    v_batch.id, 'stock_in', p_qty, p_location_id, auth.uid(), v_received_at,
    coalesce(p_batch_ref, 'Stock in')
  );

  select * into v_batch from public.stock_batches where id = v_batch.id;
  return v_batch;
end;
$$;

-- One-shot backfill: rebuild qty_remaining from the movement ledger.
update public.stock_batches b
   set qty_remaining = coalesce((
         select sum(m.qty_delta)
           from public.stock_movements m
          where m.batch_id = b.id
       ), 0);
