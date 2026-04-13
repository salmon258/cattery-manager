-- Audit log for cat sitter (assignee) changes.
-- Records every single + batch assignment change so admins can see who moved
-- which cat to which sitter and when.

create table public.assignee_change_log (
  id                 uuid        primary key default gen_random_uuid(),
  cat_id             uuid        not null
                       constraint assignee_change_log_cat_fkey
                       references public.cats(id) on delete cascade,
  from_assignee_id   uuid
                       constraint assignee_change_log_from_fkey
                       references public.profiles(id) on delete set null,
  to_assignee_id     uuid
                       constraint assignee_change_log_to_fkey
                       references public.profiles(id) on delete set null,
  changed_by         uuid
                       constraint assignee_change_log_changed_by_fkey
                       references public.profiles(id) on delete set null,
  note               text,
  changed_at         timestamptz not null default now()
);

create index assignee_change_log_cat_idx        on public.assignee_change_log(cat_id, changed_at desc);
create index assignee_change_log_to_idx         on public.assignee_change_log(to_assignee_id);
create index assignee_change_log_changed_by_idx on public.assignee_change_log(changed_by);

alter table public.assignee_change_log enable row level security;

create policy "assignee_change_log_select" on public.assignee_change_log
  for select to authenticated using (true);

-- Only admins can insert (via API routes which do the actual assignment)
create policy "assignee_change_log_insert" on public.assignee_change_log
  for insert to authenticated
  with check (public.is_admin());
