import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { RoomsClient } from '@/components/rooms/rooms-client';

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/my-cats');
  return <RoomsClient role={user.profile.role} />;
}
