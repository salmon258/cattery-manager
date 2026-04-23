import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { DailyProgressTracker } from '@/components/dashboard/daily-progress-tracker';
import {
  AdminDashboardData,
  AdminDashboardDataSkeleton
} from '@/components/dashboard/admin-dashboard-data';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  // Cat Sitters land on their own dashboard.
  if (user.profile.role !== 'admin') redirect('/my-cats');

  const t = await getTranslations();
  const ta = await getTranslations('adminDashboard');

  // Shell (header, daily tracker, quick actions) renders immediately.
  // The heavy fan-out of aggregate queries streams in via Suspense so
  // route navigation isn't blocked on 10 round-trips to Supabase.
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ta('welcome', { name: user.profile.full_name })}
        </h1>
        <p className="text-sm text-muted-foreground">{ta('subtitle')}</p>
      </header>

      <DailyProgressTracker />

      <Suspense fallback={<AdminDashboardDataSkeleton />}>
        <AdminDashboardData />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {ta('quickActions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/cats/new">{t('cats.new')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/rooms">{t('rooms.new')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/users">{t('users.new')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reports">{ta('reports')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
