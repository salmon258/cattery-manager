-- Allow cat sitters to edit/delete their own preventive treatment submissions
-- (deworming, flea, combined). Admins already have full access via the existing
-- preventive_admin_update / preventive_admin_delete policies.
-- Mirrors the pattern used for weight_logs (20260423) and eating_logs (20260429).

create policy preventive_owner_update
  on public.preventive_treatments
  for update
  to authenticated
  using (recorded_by = auth.uid())
  with check (recorded_by = auth.uid());

create policy preventive_owner_delete
  on public.preventive_treatments
  for delete
  to authenticated
  using (recorded_by = auth.uid());
