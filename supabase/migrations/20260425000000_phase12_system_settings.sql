-- Phase 12 — System Settings
-- Single-row table holding global cattery configuration.

create table public.system_settings (
  id                          int  primary key default 1,
  cattery_name                text not null default 'Cattery',
  cattery_logo_url            text,
  default_currency            text not null default 'IDR',
  gestation_days              int  not null default 63 check (gestation_days between 30 and 120),
  vaccination_lead_days       int  not null default 7  check (vaccination_lead_days  between 0 and 60),
  preventive_lead_days        int  not null default 7  check (preventive_lead_days   between 0 and 60),
  vet_followup_lead_days      int  not null default 1  check (vet_followup_lead_days between 0 and 60),
  weight_drop_alert_pct       int  not null default 10 check (weight_drop_alert_pct  between 1 and 50),
  push_notifications_enabled  boolean not null default true,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references public.profiles(id) on delete set null,
  -- Enforce single row
  constraint system_settings_singleton check (id = 1)
);

-- Seed the singleton row
insert into public.system_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.set_system_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_system_settings_updated_at();

alter table public.system_settings enable row level security;

-- All authenticated users can read settings (used by the app to render branding etc)
create policy "system_settings_select" on public.system_settings
  for select to authenticated using (true);

-- Only admins can update
create policy "system_settings_update" on public.system_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
