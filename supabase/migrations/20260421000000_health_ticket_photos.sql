-- Health Ticket Photos
-- Adds: health_ticket_photos table + health-photos storage bucket + RLS

-- ─── Table ────────────────────────────────────────────────────────────────────
create table public.health_ticket_photos (
  id           uuid        primary key default gen_random_uuid(),
  ticket_id    uuid        not null
                             constraint health_ticket_photos_ticket_fkey
                             references public.health_tickets(id) on delete cascade,
  -- null → photo attached to the ticket itself (from initial report)
  -- set  → photo attached to a specific event/comment
  event_id     uuid
                             constraint health_ticket_photos_event_fkey
                             references public.health_ticket_events(id) on delete set null,
  url          text        not null,
  storage_path text        not null,
  created_by   uuid
                             constraint health_ticket_photos_created_by_fkey
                             references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index health_ticket_photos_ticket_idx on public.health_ticket_photos(ticket_id);
create index health_ticket_photos_event_idx  on public.health_ticket_photos(event_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.health_ticket_photos enable row level security;

create policy "health_ticket_photos_select" on public.health_ticket_photos
  for select to authenticated using (true);

-- Any authenticated user can upload (sitters report issues too)
create policy "health_ticket_photos_insert" on public.health_ticket_photos
  for insert to authenticated with check (true);

-- Only admins can delete photos
create policy "health_ticket_photos_delete" on public.health_ticket_photos
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('health-photos', 'health-photos', true);

-- All authenticated users can read
create policy "health_photos_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'health-photos');

-- All authenticated users can upload
create policy "health_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'health-photos');

-- Only uploader or admin can delete
create policy "health_photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'health-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );
