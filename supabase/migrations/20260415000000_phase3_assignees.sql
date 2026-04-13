-- Phase 3: Assignees
-- No structural DB changes — cats.assignee_id already exists since Phase 1.
-- The only thing we need at the DB layer is to let any active user read
-- profile rows (currently profiles RLS restricts non-admins to their own row).
-- Required so that PostgREST can embed `assignee:profiles(id, full_name)`
-- into cat list / detail responses when the caller is a Cat Sitter.

-- New policy: any active user can SELECT any profile row.
-- Combined with the existing `profiles_select_self` / `profiles_admin_all`
-- via OR — we get a union, so admins still keep their admin-all policy.
create policy profiles_select_active_users
  on public.profiles for select
  using (public.is_active_user());

-- Optional helper: count of currently-assigned cats per assignee.
-- Used by the users list and by the bulk-reassign pre-deactivation check.
create or replace view public.assignee_cat_counts as
select
  p.id as assignee_id,
  coalesce(count(c.id), 0)::int as cat_count
from public.profiles p
left join public.cats c
  on c.assignee_id = p.id
  and c.status = 'active'
where p.role = 'cat_sitter'
group by p.id;

-- Views inherit the caller's RLS from underlying tables. Since we relaxed
-- `profiles` above and `cats` already allows active-user reads, this view
-- is effectively readable by any active user.
grant select on public.assignee_cat_counts to authenticated, anon;
