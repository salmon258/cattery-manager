import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { CatsClient } from '@/components/cats/cats-client';

export default async function CatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  return <CatsClient role={user.profile.role} />;
}
