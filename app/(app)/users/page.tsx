import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { UsersClient } from '@/components/users/users-client';

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/my-cats');
  return <UsersClient />;
}
