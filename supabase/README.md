# Supabase

## Local / cloud setup

1. Create a Supabase project at https://supabase.com.
2. Copy `.env.example` → `.env.local` at the repo root and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (used server-side only for admin user management)
3. In the Supabase SQL Editor, run each file in `supabase/migrations/` in order.
4. Bootstrap the first admin:
   - Sign up a user via the Supabase dashboard (Authentication → Users → Add user).
   - In SQL Editor: `update public.profiles set role='admin', full_name='Your Name' where id = '<that-user-id>';`
5. Visit `/login` and sign in.
