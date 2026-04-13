import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { RoomDetail } from '@/components/rooms/room-detail';

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  const supabase = createClient();
  const { data: room } = await supabase.from('rooms').select('*').eq('id', params.id).single();
  if (!room) notFound();

  const { data: occupants } = await supabase
    .from('cats')
    .select('id, name, profile_photo_url, status, breed, assignee_id')
    .eq('current_room_id', params.id)
    .order('name', { ascending: true });

  const { data: movements } = await supabase
    .from('room_movements')
    .select('*')
    .or(`from_room_id.eq.${params.id},to_room_id.eq.${params.id}`)
    .order('moved_at', { ascending: false })
    .limit(200);

  return (
    <RoomDetail
      room={room}
      initialOccupants={occupants ?? []}
      initialMovements={movements ?? []}
      role={user.profile.role}
    />
  );
}
