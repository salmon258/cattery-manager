import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getTranslations } from 'next-intl/server';
import { AdminShell } from '@/components/app/admin-shell';
import { SitterShell } from '@/components/app/sitter-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // If auth session exists but profile is missing or inactive, route through
  // /auth/signout so the cookie is actually cleared — otherwise middleware
  // would redirect /login -> / in an infinite loop.
  if (!user || !user.profile.is_active) redirect('/auth/signout');

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
