import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { StockItemDetailClient } from '@/components/stock/stock-item-detail-client';

export default async function StockItemDetailPage({
  params
}: {
  params: { itemId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  return (
    <StockItemDetailClient
      itemId={params.itemId}
      isAdmin={user.profile.role === 'admin'}
    />
  );
}
