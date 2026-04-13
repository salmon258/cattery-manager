'use client';

import imageCompression from 'browser-image-compression';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_OPTIONS = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 2000,
  useWebWorker: true,
  initialQuality: 0.85
};

export async function uploadImage(
  bucket: 'cat-photos' | 'pedigree-photos' | 'avatars' | 'health-photos',
  file: File,
  keyPrefix: string
): Promise<{ url: string; path: string }> {
  const supabase = createClient();

  const compressed = file.type.startsWith('image/')
    ? await imageCompression(file, DEFAULT_OPTIONS)
    : file;

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type || file.type
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
