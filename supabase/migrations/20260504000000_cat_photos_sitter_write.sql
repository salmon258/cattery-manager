-- Allow cat sitters to add cat photos (and delete the ones they uploaded).
-- Admins retain full access via the existing cat_photos_admin_write / storage
-- admin policies. Selects are already open to any active user.

-- ------------ cat_photos table ------------
create policy cat_photos_active_insert
  on public.cat_photos
  for insert
  to authenticated
  with check (public.is_active_user() and created_by = auth.uid());

create policy cat_photos_owner_delete
  on public.cat_photos
  for delete
  to authenticated
  using (created_by = auth.uid());

-- ------------ cat-photos storage bucket ------------
create policy "cat-photos-active-write"
  on storage.objects for insert
  with check (
    bucket_id = 'cat-photos' and public.is_active_user()
  );

create policy "cat-photos-owner-delete"
  on storage.objects for delete
  using (
    bucket_id = 'cat-photos' and owner = auth.uid()
  );
