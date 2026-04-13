import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/aliases';

export async function getCurrentUser(): Promise<{ authId: string; profile: Profile } | null> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) console.error('[getCurrentUser] auth.getUser error:', authError.message);
  if (!user) {
    console.warn('[getCurrentUser] no auth user');
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[getCurrentUser] profile fetch error:', profileError.message, 'for user', user.id);
    return null;
  }
  if (!profile) {
    console.warn('[getCurrentUser] no profile row for auth user', user.id, user.email);
    return null;
  }
  return { authId: user.id, profile: profile as Profile };
}

export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u) throw new Error('Not authenticated');
  if (u.profile.role !== 'admin') throw new Error('Forbidden: admin only');
  if (!u.profile.is_active) throw new Error('Forbidden: account disabled');
  return u;
}
