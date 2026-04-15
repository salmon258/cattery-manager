-- Allow admins to manage cat_lineage rows after the fact.
--
-- Phase 9 only exposed an INSERT policy, which meant the only way to assign
-- parents was at litter-registration time. We now need:
--
--   1. UPDATE  — so an admin can edit (or re-parent) an existing lineage row.
--   2. DELETE  — so an admin can clear an incorrect parent assignment.
--
-- Both are still admin-gated; regular users keep read-only access.

create policy "cat_lineage_update" on public.cat_lineage
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "cat_lineage_delete" on public.cat_lineage
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
