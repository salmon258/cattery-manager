-- Fix: admins couldn't edit another sitter's meal.
--
-- The PATCH /api/eating-logs/[id] route replaces the item set with a
-- delete-then-insert. `eating_log_items_admin_delete` (from the original
-- phase4 migration) lets an admin wipe the existing rows, but the only
-- INSERT policy on the table is `eating_log_items_insert`, whose check
-- requires the parent log's `submitted_by = auth.uid()`. That excludes
-- admins acting on someone else's meal, so the second half of the edit
-- failed with "new row violates row-level security policy for table
-- eating_log_items".
--
-- Add an admin-scoped INSERT policy to mirror the existing
-- admin_update / admin_delete policies.

create policy eating_log_items_admin_insert
  on public.eating_log_items
  for insert
  to authenticated
  with check (public.is_admin());
