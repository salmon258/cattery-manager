import { queryOptions } from '@tanstack/react-query';
import type { Cat, CatPhoto } from '@/lib/supabase/aliases';

export type CatDetailPayload = {
  cat: Cat;
  photos: CatPhoto[];
  currentRoom: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

async function fetchCatDetail(id: string): Promise<CatDetailPayload | null> {
  const r = await fetch(`/api/cats/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Failed to load cat');
  return r.json();
}

/**
 * Single source of truth for the `/cats/[id]` query shape. Use with
 * `useQuery(catDetailQueryOptions(id))` in components, or
 * `queryClient.prefetchQuery(catDetailQueryOptions(id))` to warm the cache
 * on hover/focus. The `['cat', id]` key aligns with existing
 * `invalidateQueries({ queryKey: ['cat', catId] })` calls in cat-form,
 * move-room, assign-cat, and log-weight modals.
 */
export function catDetailQueryOptions(catId: string) {
  return queryOptions({
    queryKey: ['cat', catId] as const,
    queryFn: () => fetchCatDetail(catId)
  });
}
