import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { MyCatsClient } from '@/components/cats/my-cats-client';

export default async function MyCatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  // Admins don't have a "my cats" concept — redirect to the cats list.
  if (user.profile.role === 'admin') redirect('/cats');
  return <MyCatsClient firstName={user.profile.full_name.split(' ')[0]} />;
}
