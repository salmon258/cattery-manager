-- Phase 4: Daily Care Logs
-- Weight logs, food catalogue, eating logs (meal sessions + per-item rows),
-- and a helper view for "latest weight per cat" so the server can compute
-- recommended daily kcal without a client round-trip.

-- ============================================================================
-- weight_logs
-- ============================================================================
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg < 30),
  recorded_at timestamptz not null default now(),
  photo_url text,
  notes text,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index weight_logs_cat_recorded_idx on public.weight_logs(cat_id, recorded_at desc);

-- Latest weight per cat — used to compute RER / recommended daily kcal.
create or replace view public.cat_latest_weight as
select distinct on (cat_id)
  cat_id,
  id as weight_log_id,
  weight_kg,
  recorded_at
from public.weight_logs
order by cat_id, recorded_at desc;

grant select on public.cat_latest_weight to authenticated, anon;

-- ============================================================================
-- food_items (Admin-curated catalogue)
-- ============================================================================
create type food_type as enum ('wet', 'dry', 'raw', 'treat', 'supplement', 'other');
create type food_unit as enum ('g', 'ml', 'sachet', 'piece');

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  type food_type not null default 'dry',
  calories_per_gram numeric(5,2) not null check (calories_per_gram >= 0 and calories_per_gram <= 20),
  unit food_unit not null default 'g',
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index food_items_is_active_idx on public.food_items(is_active);

create trigger food_items_set_updated_at
  before update on public.food_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- eating_logs (meal session) + eating_log_items (per-food rows)
-- ============================================================================
create type feeding_method as enum ('self', 'assisted', 'force_fed');
create type eaten_ratio as enum ('all', 'most', 'half', 'little', 'none');

create table public.eating_logs (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  meal_time timestamptz not null default now(),
  feeding_method feeding_method not null default 'self',
  notes text,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index eating_logs_cat_meal_idx on public.eating_logs(cat_id, meal_time desc);

create table public.eating_log_items (
  id uuid primary key default gen_random_uuid(),
  eating_log_id uuid not null references public.eating_logs(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete restrict,
  quantity_given_g numeric(7,2) not null check (quantity_given_g >= 0),
  quantity_eaten eaten_ratio not null default 'all',
  -- Snapshot of food_items.calories_per_gram at submission time.
  -- Required and immutable so historical reports stay accurate even if
  -- admin later edits the catalogue value.
  calories_per_gram_snapshot numeric(5,2) not null,
  -- Convenience-stored computed column: kcal for this row.
  -- Ratio map: all=1.0, most=0.75, half=0.5, little=0.2, none=0.0.
  estimated_kcal_consumed numeric(8,2) generated always as (
    quantity_given_g *
    calories_per_gram_snapshot *
    case quantity_eaten
      when 'all' then 1.0
      when 'most' then 0.75
      when 'half' then 0.5
      when 'little' then 0.2
      when 'none' then 0.0
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index eating_log_items_log_idx on public.eating_log_items(eating_log_id);
create index eating_log_items_food_idx on public.eating_log_items(food_item_id);

-- ============================================================================
-- Recommended daily kcal helper (RER × life_stage_multiplier)
-- RER = 70 × (weight_kg ^ 0.75)
-- ============================================================================
create or replace function public.recommended_daily_kcal(p_cat_id uuid)
returns numeric language sql stable as $$
  select round(
    (70 * power(lw.weight_kg, 0.75) * c.life_stage_multiplier)::numeric,
    0
  )
  from public.cats c
  left join public.cat_latest_weight lw on lw.cat_id = c.id
  where c.id = p_cat_id and lw.weight_kg is not null;
$$;

-- ============================================================================
-- RLS
-- Any active user reads + inserts; admin also updates/deletes.
-- This matches spec §8.1: "Any Cat Sitter can submit any report ... for any cat".
-- ============================================================================
alter table public.weight_logs enable row level security;
alter table public.food_items enable row level security;
alter table public.eating_logs enable row level security;
alter table public.eating_log_items enable row level security;

-- weight_logs
create policy weight_logs_select on public.weight_logs for select
  using (public.is_active_user());
create policy weight_logs_insert on public.weight_logs for insert
  with check (public.is_active_user() and submitted_by = auth.uid());
create policy weight_logs_admin_write on public.weight_logs for update
  using (public.is_admin()) with check (public.is_admin());
create policy weight_logs_admin_delete on public.weight_logs for delete
  using (public.is_admin());

-- food_items: active users read; admins write (catalogue is Admin-curated)
create policy food_items_select on public.food_items for select
  using (public.is_active_user());
create policy food_items_admin_all on public.food_items for all
  using (public.is_admin()) with check (public.is_admin());

-- eating_logs
create policy eating_logs_select on public.eating_logs for select
  using (public.is_active_user());
create policy eating_logs_insert on public.eating_logs for insert
  with check (public.is_active_user() and submitted_by = auth.uid());
create policy eating_logs_admin_update on public.eating_logs for update
  using (public.is_admin()) with check (public.is_admin());
create policy eating_logs_admin_delete on public.eating_logs for delete
  using (public.is_admin());

-- eating_log_items: mirrors parent (write allowed if parent is writeable).
-- We enforce via subquery check against the parent row.
create policy eating_log_items_select on public.eating_log_items for select
  using (public.is_active_user());
create policy eating_log_items_insert on public.eating_log_items for insert
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.eating_logs el
      where el.id = eating_log_id and el.submitted_by = auth.uid()
    )
  );
create policy eating_log_items_admin_update on public.eating_log_items for update
  using (public.is_admin()) with check (public.is_admin());
create policy eating_log_items_admin_delete on public.eating_log_items for delete
  using (public.is_admin());
