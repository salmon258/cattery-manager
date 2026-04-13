-- Phase 1: Foundation — profiles, cats, cat_photos
-- Enables pgcrypto for UUID; sets up RLS.

create extension if not exists "pgcrypto";

-- Schema-level grants (restore defaults after a `drop schema public cascade`).
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

-- ============================================================================
-- profiles
-- ============================================================================
create type user_role as enum ('admin', 'cat_sitter');
create type theme_pref as enum ('light', 'dark', 'system');
create type lang_code as enum ('en', 'id');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'cat_sitter',
  avatar_url text,
  is_active boolean not null default true,
  preferred_language lang_code not null default 'en',
  theme_preference theme_pref not null default 'system',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_is_active_idx on public.profiles(is_active);

-- ============================================================================
-- cats
-- ============================================================================
create type cat_gender as enum ('male', 'female');
create type cat_status as enum ('active', 'retired', 'deceased', 'sold');

create table public.cats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date_of_birth date not null,
  gender cat_gender not null,
  breed text,
  microchip_number text,
  registration_number text,
  color_pattern text,
  status cat_status not null default 'active',
  status_changed_at date,
  profile_photo_url text,
  pedigree_photo_url text,
  assignee_id uuid references public.profiles(id) on delete set null,
  life_stage_multiplier numeric(3,2) not null default 1.2,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cats_status_idx on public.cats(status);
create index cats_assignee_idx on public.cats(assignee_id);

-- ============================================================================
-- cat_photos (gallery)
-- ============================================================================
create table public.cat_photos (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  url text not null,
  storage_path text not null,
  sort_order int not null default 0,
  is_profile boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index cat_photos_cat_id_idx on public.cat_photos(cat_id);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger cats_set_updated_at
  before update on public.cats
  for each row execute function public.set_updated_at();

-- ============================================================================
-- auth.users -> profiles bootstrap
-- When an Admin creates an auth user (via service role), we auto-create a
-- minimal profile row. The admin-user-management flow fills in real values.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cat_sitter')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- role helper
-- ============================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.cats enable row level security;
alter table public.cat_photos enable row level security;

-- profiles: users read own row; admins read all; only admins write
create policy profiles_select_self
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self_limited
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- cats: any active user can read; only admins write
create policy cats_select_active_users
  on public.cats for select
  using (public.is_active_user());

create policy cats_admin_insert
  on public.cats for insert
  with check (public.is_admin());

create policy cats_admin_update
  on public.cats for update
  using (public.is_admin())
  with check (public.is_admin());

create policy cats_admin_delete
  on public.cats for delete
  using (public.is_admin());

-- cat_photos: active users read; admins write
create policy cat_photos_select_active
  on public.cat_photos for select
  using (public.is_active_user());

create policy cat_photos_admin_write
  on public.cat_photos for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- Storage buckets (cat-photos, pedigree-photos, avatars)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('cat-photos', 'cat-photos', true),
  ('pedigree-photos', 'pedigree-photos', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies: anyone authenticated can read, admins can write
create policy "cat-photos-public-read"
  on storage.objects for select
  using (bucket_id in ('cat-photos', 'pedigree-photos', 'avatars'));

create policy "cat-photos-admin-write"
  on storage.objects for insert
  with check (
    bucket_id in ('cat-photos', 'pedigree-photos') and public.is_admin()
  );

create policy "cat-photos-admin-update"
  on storage.objects for update
  using (
    bucket_id in ('cat-photos', 'pedigree-photos') and public.is_admin()
  );

create policy "cat-photos-admin-delete"
  on storage.objects for delete
  using (
    bucket_id in ('cat-photos', 'pedigree-photos') and public.is_admin()
  );

create policy "avatars-self-write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and auth.uid() is not null
  );

create policy "avatars-self-update"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid() is not null);

-- ============================================================================
-- Table-level grants for authenticated/anon roles.
-- Required for RLS to even be evaluated; Supabase's default projects ship with
-- these grants but `drop schema public cascade` wipes them along with tables.
-- ============================================================================
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Apply the same grants to any tables created after this migration
-- (every Phase 2+ migration will inherit these).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
