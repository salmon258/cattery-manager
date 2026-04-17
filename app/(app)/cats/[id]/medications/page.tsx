import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { MedicationsDetail } from '@/components/cats/detail/medications-detail';

export default async function CatMedicationsDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  const supabase = createClient();
  const { data: cat } = await supabase
    .from('cats')
    .select('id, name, profile_photo_url')
    .eq('id', params.id)
    .single();
  if (!cat) notFound();

  return (
    <MedicationsDetail
      catId={cat.id}
      catName={cat.name}
      profilePhotoUrl={cat.profile_photo_url}
      role={user.profile.role}
    />
  );
}
