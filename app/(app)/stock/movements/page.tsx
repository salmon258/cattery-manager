import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StockMovementsClient } from '@/components/stock/stock-movements-client';

export default async function StockMovementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  return <StockMovementsClient />;
}
