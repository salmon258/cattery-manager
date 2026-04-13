import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { BreedingClient } from '@/components/breeding/breeding-client';

export default async function BreedingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/');
  return <BreedingClient />;
}
