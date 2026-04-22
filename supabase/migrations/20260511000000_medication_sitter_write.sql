-- Allow cat sitters to manage medication schedules for their cats.
--
-- Previously `medications_admin_all` gated every write on the table behind
-- `is_admin()`, forcing sitters to ping an admin before they could start a
-- new course, pause one, or stop it. The app flow now treats medication
-- scheduling as part of daily-care duties, so we widen the policies to any
-- active user. Row visibility is still handled by the pre-existing
-- `medications_select` policy, and the per-cat assignment check lives at the
-- application layer (the UI only shows medications for cats the sitter can
-- already see).
--
-- Admins retain full access because `is_active_user()` is a superset of
-- `is_admin()`.

drop policy if exists medications_admin_all on public.medications;

create policy medications_active_insert
  on public.medications
  for insert
  to authenticated
  with check (public.is_active_user());

create policy medications_active_update
  on public.medications
  for update
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

create policy medications_active_delete
  on public.medications
  for delete
  to authenticated
  using (public.is_active_user());

-- Overdue medication tasks used to be admin-only to delete (sitters could only
-- confirm or skip). That left cleanup of stale rows blocked for sitters whose
-- cat's schedule they now manage end-to-end. Mirror the medications change
-- with an active-user delete policy.

drop policy if exists medication_tasks_admin_delete on public.medication_tasks;

create policy medication_tasks_active_delete
  on public.medication_tasks
  for delete
  to authenticated
  using (public.is_active_user());
