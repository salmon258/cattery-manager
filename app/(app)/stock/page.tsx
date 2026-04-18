import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StockOverviewClient } from '@/components/stock/stock-overview-client';

export default async function StockOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  return <StockOverviewClient isAdmin={user.profile.role === 'admin'} />;
}
