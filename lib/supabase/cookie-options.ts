import type { CookieOptions } from '@supabase/ssr';

/**
 * Long-lived auth cookie max-age. Supabase auth cookies (`sb-*`) are otherwise
 * session-only on some browsers, so users get logged out when they close the
 * tab. We extend them to 1 year so the only way out is an explicit logout.
 *
 * Note: the server-side refresh-token expiry is controlled in the Supabase
 * project dashboard (Auth → JWT settings → Refresh token expiry, default 30 d).
 * Set that to 1 year there too if you want the full effect.
 */
export const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Force a long max-age on the Supabase auth cookies. Pass-through for everything
 * else. Supabase uses `sb-` prefixed cookie names for both the access and refresh
 * tokens.
 */
export function persistAuthCookieOptions(name: string, options: CookieOptions): CookieOptions {
  if (!name.startsWith('sb-')) return options;
  return { ...options, maxAge: ONE_YEAR_SECONDS };
}
