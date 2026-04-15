-- Allow cat sitters to edit/delete their own eating log submissions.
-- Admins already have full access via the existing *_admin_update / *_admin_delete policies.
-- Mirrors the pattern used for weight_logs in 20260423000000_weight_log_owner_edit.sql.

-- ------------ eating_logs (meal session) ------------
create policy eating_logs_owner_update
  on public.eating_logs
  for update
  to authenticated
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());

create policy eating_logs_owner_delete
  on public.eating_logs
  for delete
  to authenticated
  using (submitted_by = auth.uid());

-- ------------ eating_log_items (per-food rows) ------------
-- Writeable if the parent log is owned by the current user. Delete via ON
-- DELETE CASCADE on eating_logs already handles parent-delete flows, but we
-- still need explicit update + delete policies so the API can replace the
-- item set when the user edits a meal (delete-then-insert pattern).
create policy eating_log_items_owner_update
  on public.eating_log_items
  for update
  to authenticated
  using (
    exists (
      select 1 from public.eating_logs el
      where el.id = eating_log_id and el.submitted_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.eating_logs el
      where el.id = eating_log_id and el.submitted_by = auth.uid()
    )
  );

create policy eating_log_items_owner_delete
  on public.eating_log_items
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.eating_logs el
      where el.id = eating_log_id and el.submitted_by = auth.uid()
    )
  );
