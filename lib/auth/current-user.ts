import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/aliases';

/**
 * Cached per-request so layout.tsx and page.tsx components that both need
 * the current user only trigger one `supabase.auth.getUser()` call. Without
 * this, every page load ran the auth check twice in parallel, which could
 * race on refresh-token rotation and randomly log sitters out mid-action.
 */
export const getCurrentUser = cache(
  async (): Promise<{ authId: string; profile: Profile } | null> => {
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
);

export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u) throw new Error('Not authenticated');
  if (u.profile.role !== 'admin') throw new Error('Forbidden: admin only');
  if (!u.profile.is_active) throw new Error('Forbidden: account disabled');
  return u;
}
