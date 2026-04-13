import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cat, Home, Users, TrendingUp } from 'lucide-react';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  // Cat Sitters land on their own dashboard.
  if (user.profile.role !== 'admin') redirect('/my-cats');

  const supabase = createClient();
  const t = await getTranslations();
  const ta = await getTranslations('adminDashboard');

  const [{ count: catsCount }, { count: roomsCount }, { count: usersCount }] = await Promise.all([
    supabase.from('cats').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true)
  ]);

  const stats = [
    { href: '/cats', label: t('nav.cats'), value: catsCount ?? 0, icon: Cat, hint: ta('activeProfiles') },
    { href: '/rooms', label: t('nav.rooms'), value: roomsCount ?? 0, icon: Home, hint: ta('activeRooms') },
    { href: '/users', label: t('nav.users'), value: usersCount ?? 0, icon: Users, hint: ta('activeUsers') }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{ta('welcome', { name: user.profile.full_name })}</h1>
        <p className="text-sm text-muted-foreground">{ta('subtitle')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="group">
              <Card className="transition-all hover:border-primary/40 hover:shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">{s.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {ta('quickActions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/cats/new">{t('cats.new')}</Link></Button>
          <Button asChild variant="outline"><Link href="/rooms">{t('rooms.new')}</Link></Button>
          <Button asChild variant="outline"><Link href="/users">{t('users.new')}</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
