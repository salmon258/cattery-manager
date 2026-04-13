import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { FoodItemsClient } from '@/components/food/food-items-client';

export default async function FoodItemsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/my-cats');
  return <FoodItemsClient />;
}
