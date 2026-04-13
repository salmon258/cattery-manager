'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Cat, UserRole } from '@/lib/supabase/types';
import { Home, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type CatRow = Cat & {
  current_room?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string } | null;
};

async function fetchCats(q: string): Promise<CatRow[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const r = await fetch(`/api/cats?${params.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed');
  return (await r.json()).cats;
}

export function CatsClient({ role }: { role: UserRole }) {
  const t = useTranslations('cats');
  const tc = useTranslations('common');
  const ts = useTranslations('cats.status');
  const [q, setQ] = useState('');

  const { data: cats = [], isLoading, error, refetch } = useQuery({
    queryKey: ['cats', q],
    queryFn: () => fetchCats(q)
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        {role === 'admin' && (
          <Button asChild><Link href="/cats/new"><Plus className="h-4 w-4" /> {t('new')}</Link></Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tc('search')}
          className="pl-9"
        />
      </div>

      {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">{tc('loading')}</CardContent></Card>}
      {error && (
        <Card>
          <CardContent className="p-6 text-sm flex items-center justify-between">
            <span className="text-destructive">{tc('error')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{tc('retry')}</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && cats.length === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{t('list.empty')}</CardContent></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Link key={c.id} href={`/cats/${c.id}`}>
            <Card className="hover:bg-accent/40 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {c.profile_photo_url ? <AvatarImage src={c.profile_photo_url} alt={c.name} /> : null}
                  <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-2">
                    {c.name}
                    <Badge variant={c.status === 'active' ? 'secondary' : 'outline'} className="capitalize">
                      {ts(c.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.breed ?? '—'} · {formatDate(c.date_of_birth)}
                  </div>
                  {c.current_room && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Home className="h-3 w-3" /> {c.current_room.name}
                    </div>
                  )}
                  {c.assignee && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <User className="h-3 w-3" /> {c.assignee.full_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
