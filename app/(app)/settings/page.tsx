import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { SettingsClient } from '@/components/settings/settings-client';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/');
  return <SettingsClient />;
}
