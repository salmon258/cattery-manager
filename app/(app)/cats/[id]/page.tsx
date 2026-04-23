import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { CatDetailLoader } from '@/components/cats/cat-detail-loader';

export default async function CatDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  // Data (cat, photos, room, assignee) is now fetched client-side via
  // useQuery + /api/cats/[id], so repeat visits paint instantly from the
  // React Query IndexedDB persister and a stale-while-revalidate refetch
  // keeps the view current in the background.
  return (
    <CatDetailLoader catId={params.id} role={user.profile.role} currentUserId={user.authId} />
  );
}
