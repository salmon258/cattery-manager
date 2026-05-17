-- Allow cat sitters to delete recorded ad-hoc medicines.
--
-- `ad_hoc_medicines_admin_delete` gated deletion behind `is_admin()`, so a
-- sitter who logged a one-off medicine by mistake (wrong cat, wrong dose) had
-- to ask an admin to clean it up. Medicine logging is now part of daily-care
-- duties, so widen the delete policy to any active user, mirroring the
-- `medications`/`medication_tasks` sitter-write changes.
--
-- Admins retain full access because `is_active_user()` is a superset of
-- `is_admin()`.

drop policy if exists ad_hoc_medicines_admin_delete on public.ad_hoc_medicines;

create policy ad_hoc_medicines_active_delete
  on public.ad_hoc_medicines
  for delete
  to authenticated
  using (public.is_active_user());
