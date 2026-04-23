'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import type { Cat, CatPhoto, UserRole } from '@/lib/supabase/aliases';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CatDetail } from '@/components/cats/cat-detail';

type CatDetailPayload = {
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

interface Props {
  catId: string;
  role: UserRole;
  currentUserId: string;
}

export function CatDetailLoader({ catId, role, currentUserId }: Props) {
  // Bundled into a single key so the whole detail view restores from IDB
  // in one shot. SW's /api/* StaleWhileRevalidate handles the backing
  // HTTP cache; React Query's persister handles cross-session memory.
  // Key aligns with existing `invalidateQueries({ queryKey: ['cat', catId] })`
  // calls in cat-form / move-room / assign / log-weight modals, so mutations
  // keep refreshing the detail view for free.
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['cat', catId],
    queryFn: () => fetchCatDetail(catId)
  });

  if (isPending) return <CatDetailSkeleton />;

  if (isError) {
    return <CatDetailError onRetry={() => refetch()} />;
  }

  if (!data) {
    return <CatDetailNotFound />;
  }

  return (
    <CatDetail
      cat={data.cat}
      initialPhotos={data.photos}
      currentRoom={data.currentRoom}
      assignee={data.assignee}
      role={role}
      currentUserId={currentUserId}
    />
  );
}

function CatDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <Skeleton className="h-12 w-full" />

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CatDetailError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('common');
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-muted-foreground">{t('errorLoading') || 'Something went wrong.'}</p>
      <Button variant="outline" onClick={onRetry}>
        {t('retry') || 'Retry'}
      </Button>
    </div>
  );
}

function CatDetailNotFound() {
  const t = useTranslations('cats');
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-lg font-medium">{t('notFound') || 'Cat not found'}</p>
      <Button asChild variant="outline">
        <Link href="/cats">{t('backToList') || 'Back to list'}</Link>
      </Button>
    </div>
  );
}
