import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { VetDetail } from '@/components/cats/detail/vet-detail';

export default async function CatVetDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  // Vet history is admin-only; match the behaviour of VetVisitsCard.
  if (user.profile.role !== 'admin') redirect(`/cats/${params.id}`);

  const supabase = createClient();
  const { data: cat } = await supabase
    .from('cats')
    .select('id, name, profile_photo_url')
    .eq('id', params.id)
    .single();
  if (!cat) notFound();

  return (
    <VetDetail
      catId={cat.id}
      catName={cat.name}
      profilePhotoUrl={cat.profile_photo_url}
      role={user.profile.role}
    />
  );
}
