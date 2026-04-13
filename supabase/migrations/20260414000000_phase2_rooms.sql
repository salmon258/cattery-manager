-- Phase 2: Room Management
-- Adds rooms directory, cats.current_room_id, and append-only room_movements log.

-- ============================================================================
-- rooms
-- ============================================================================
create type room_type as enum ('breeding', 'kitten', 'quarantine', 'general', 'isolation', 'other');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type room_type not null default 'general',
  capacity int,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rooms_is_active_idx on public.rooms(is_active);
create index rooms_type_idx on public.rooms(type);

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ============================================================================
-- cats.current_room_id
-- ============================================================================
alter table public.cats
  add column current_room_id uuid references public.rooms(id) on delete set null;

create index cats_current_room_idx on public.cats(current_room_id);

-- ============================================================================
-- room_movements (append-only log)
-- ============================================================================
create table public.room_movements (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  from_room_id uuid references public.rooms(id) on delete set null,
  to_room_id uuid references public.rooms(id) on delete set null,
  moved_at timestamptz not null default now(),
  moved_by uuid references public.profiles(id) on delete set null,
  reason text
);

create index room_movements_cat_idx on public.room_movements(cat_id, moved_at desc);
create index room_movements_to_idx on public.room_movements(to_room_id, moved_at desc);
create index room_movements_from_idx on public.room_movements(from_room_id, moved_at desc);

-- ============================================================================
-- Movement logging trigger
-- Fires whenever cats.current_room_id changes (from any path). Reads an
-- optional reason from session GUC `app.move_reason` (set by `move_cat` RPC).
-- SECURITY DEFINER → bypasses RLS on room_movements when inserting.
-- ============================================================================
create or replace function public.log_room_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reason text;
begin
  if new.current_room_id is not distinct from old.current_room_id then
    return new;
  end if;
  begin
    v_reason := nullif(current_setting('app.move_reason', true), '');
  exception when others then
    v_reason := null;
  end;
  insert into public.room_movements (cat_id, from_room_id, to_room_id, moved_by, reason)
  values (new.id, old.current_room_id, new.current_room_id, auth.uid(), v_reason);
  return new;
end;
$$;

create trigger cats_log_room_movement
  after update of current_room_id on public.cats
  for each row execute function public.log_room_movement();

-- ============================================================================
-- move_cat RPC
-- Atomic admin-only move that stashes the reason into a session-local GUC
-- so the trigger can pick it up.
-- ============================================================================
create or replace function public.move_cat(p_cat_id uuid, p_to_room_id uuid, p_reason text default null)
returns public.cats language plpgsql security definer set search_path = public as $$
declare
  v_cat public.cats;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  perform set_config('app.move_reason', coalesce(p_reason, ''), true);

  update public.cats
     set current_room_id = p_to_room_id
   where id = p_cat_id
  returning * into v_cat;

  if v_cat.id is null then
    raise exception 'cat not found' using errcode = 'P0002';
  end if;

  return v_cat;
end;
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.rooms enable row level security;
alter table public.room_movements enable row level security;

-- rooms: any active user reads; only admins write
create policy rooms_select_active
  on public.rooms for select
  using (public.is_active_user());

create policy rooms_admin_all
  on public.rooms for all
  using (public.is_admin())
  with check (public.is_admin());

-- room_movements: any active user reads; writes only via trigger (SECURITY DEFINER)
create policy room_movements_select_active
  on public.room_movements for select
  using (public.is_active_user());
-- (no INSERT/UPDATE/DELETE policies → direct user writes are denied by RLS)
