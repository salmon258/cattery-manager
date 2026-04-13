import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const LOCALES = ['en', 'id'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export default getRequestConfig(async () => {
  let locale: Locale = DEFAULT_LOCALE;

  // 1. Cookie override
  const cookieLocale = cookies().get('NEXT_LOCALE')?.value;
  if (cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)) {
    locale = cookieLocale as Locale;
  } else {
    // 2. User preference (if logged in)
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', user.id)
          .single();
        if (profile?.preferred_language) {
          locale = profile.preferred_language as Locale;
        }
      }
    } catch {
      // ignore — fall through to default
    }
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
