import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StockItemsClient } from '@/components/stock/stock-items-client';

export default async function StockItemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  return <StockItemsClient isAdmin={user.profile.role === 'admin'} />;
}
