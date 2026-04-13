import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { CatDetail } from '@/components/cats/cat-detail';

export default async function CatDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  const supabase = createClient();

  const { data: cat } = await supabase.from('cats').select('*').eq('id', params.id).single();
  if (!cat) notFound();

  const { data: photos } = await supabase
    .from('cat_photos')
    .select('*')
    .eq('cat_id', params.id)
    .order('sort_order', { ascending: true });

  let currentRoom = null as { id: string; name: string } | null;
  if (cat.current_room_id) {
    const { data: room } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('id', cat.current_room_id)
      .single();
    currentRoom = room;
  }

  let assignee = null as { id: string; full_name: string } | null;
  if (cat.assignee_id) {
    const { data: a } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', cat.assignee_id)
      .single();
    assignee = a;
  }

  return (
    <CatDetail
      cat={cat}
      initialPhotos={photos ?? []}
      currentRoom={currentRoom}
      assignee={assignee}
      role={user.profile.role}
    />
  );
}
