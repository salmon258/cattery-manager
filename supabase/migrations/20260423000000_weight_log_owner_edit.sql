-- Allow cat sitters to edit/delete their own weight log submissions.
-- Admins already have full access via the existing *_admin_write / *_admin_delete policies.

create policy weight_logs_owner_update
  on public.weight_logs
  for update
  to authenticated
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());

create policy weight_logs_owner_delete
  on public.weight_logs
  for delete
  to authenticated
  using (submitted_by = auth.uid());
