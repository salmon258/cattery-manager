import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

const addPhotoSchema = z.object({
  url: z.string().url(),
  storage_path: z.string().min(1),
  is_profile: z.boolean().optional()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = addPhotoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const supabase = createClient();

  const { count } = await supabase
    .from('cat_photos')
    .select('id', { count: 'exact', head: true })
    .eq('cat_id', params.id);

  const isFirst = (count ?? 0) === 0;
  const isProfile = parsed.data.is_profile ?? isFirst;

  if (isProfile) {
    await supabase.from('cat_photos').update({ is_profile: false }).eq('cat_id', params.id);
  }

  const { data, error } = await supabase
    .from('cat_photos')
    .insert({
      cat_id: params.id,
      url: parsed.data.url,
      storage_path: parsed.data.storage_path,
      sort_order: count ?? 0,
      is_profile: isProfile,
      created_by: user.authId
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isProfile) {
    await supabase.from('cats').update({ profile_photo_url: parsed.data.url }).eq('id', params.id);
  }

  return NextResponse.json({ photo: data }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const photoId = url.searchParams.get('photo_id');
  if (!photoId) return NextResponse.json({ error: 'photo_id required' }, { status: 400 });

  const supabase = createClient();
  const { data: photo } = await supabase.from('cat_photos').select('*').eq('id', photoId).single();
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await supabase.storage.from('cat-photos').remove([photo.storage_path]).catch(() => {});
  const { error } = await supabase.from('cat_photos').delete().eq('id', photoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (photo.is_profile) {
    const { data: remaining } = await supabase
      .from('cat_photos')
      .select('*')
      .eq('cat_id', params.id)
      .order('sort_order', { ascending: true })
      .limit(1);
    const newProfile = remaining?.[0];
    if (newProfile) {
      await supabase.from('cat_photos').update({ is_profile: true }).eq('id', newProfile.id);
      await supabase.from('cats').update({ profile_photo_url: newProfile.url }).eq('id', params.id);
    } else {
      await supabase.from('cats').update({ profile_photo_url: null }).eq('id', params.id);
    }
  }

  return NextResponse.json({ ok: true });
}
