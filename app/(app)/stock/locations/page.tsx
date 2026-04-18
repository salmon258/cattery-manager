import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StockLocationsClient } from '@/components/stock/stock-locations-client';

export default async function StockLocationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/stock');
  return <StockLocationsClient />;
}
