import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { ReportsClient } from '@/components/reports/reports-client';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/');
  return <ReportsClient />;
}
