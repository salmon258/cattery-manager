-- Phase 7 — PWA: push notification subscriptions + background sync queue
-- ─────────────────────────────────────────────────────────────────────

-- ┌──────────────────────────────────────────────────────┐
-- │ push_subscriptions                                   │
-- │ One row per browser/device per user                  │
-- └──────────────────────────────────────────────────────┘
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  -- Enforce one subscription per endpoint (a device can only register once)
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- ┌──────────────────────────────────────────────────────┐
-- │ background_sync_queue                                │
-- │ Stores offline task confirmations to replay when    │
-- │ the browser comes back online via Background Sync   │
-- └──────────────────────────────────────────────────────┘
create table if not exists background_sync_queue (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,          -- e.g. 'confirm_task'
  payload     jsonb not null,         -- e.g. { task_id: "..." }
  created_at  timestamptz not null default now(),
  processed   boolean not null default false,
  processed_at timestamptz
);

create index if not exists bsq_user_unprocessed_idx
  on background_sync_queue(user_id)
  where processed = false;

-- ──────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────
alter table push_subscriptions enable row level security;
alter table background_sync_queue enable row level security;

-- Users can manage their own subscriptions only
create policy "push_subscriptions_own_select" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subscriptions_own_insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subscriptions_own_delete" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- Admins can read all subscriptions (needed to fan-out notifications)
create policy "push_subscriptions_admin_select" on push_subscriptions
  for select using (is_admin());

-- Users can manage their own sync queue
create policy "bsq_own_all" on background_sync_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
