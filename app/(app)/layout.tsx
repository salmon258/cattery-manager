import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getTranslations } from 'next-intl/server';
import { AdminShell } from '@/components/app/admin-shell';
import { SitterShell } from '@/components/app/sitter-shell';

const SESSION_COOKIE_RE = /^sb-.*-auth-token(\.\d+)?$/;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Two distinct failure modes:
  //   1. Transient: the auth cookies are still on the request but
  //      getUser() returned null (typically a refresh-token race). Send
  //      the sitter to /login without clearing cookies so the session
  //      can recover on the next request / browser-side auto-refresh.
  //   2. Real signout: no session cookie at all, or the profile is
  //      deactivated. Route through /auth/signout to actually clear the
  //      cookie — otherwise middleware would redirect /login -> / in an
  //      infinite loop.
  if (!user) {
    const hasSession = cookies().getAll().some((c) => SESSION_COOKIE_RE.test(c.name));
    redirect(hasSession ? '/login' : '/auth/signout');
  }
  if (!user.profile.is_active) redirect('/auth/signout');

  const t = await getTranslations();
  const brandName = t('app.name');

  if (user.profile.role === 'admin') {
    return (
      <AdminShell profile={user.profile} brandName={brandName}>
        {children}
      </AdminShell>
    );
  }

  return (
    <SitterShell profile={user.profile} brandName={brandName}>
      {children}
    </SitterShell>
  );
}
