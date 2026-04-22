import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cat, Home, Users, TrendingUp, HeartPulse, Syringe, Stethoscope, Activity, Package, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DailyProgressTracker } from '@/components/dashboard/daily-progress-tracker';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');

  // Cat Sitters land on their own dashboard.
  if (user.profile.role !== 'admin') redirect('/my-cats');

  const supabase = createClient();
  const t = await getTranslations();
  const ta = await getTranslations('adminDashboard');

  const todayStr   = new Date().toISOString().slice(0, 10);
  const in14Days   = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const in30Days   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Parallel fetch all dashboard data
  const [
    catsAgg,
    roomsAgg,
    usersAgg,
    openTicketsBySeverity,
    upcomingVacc,
    upcomingPrev,
    upcomingFollowups,
    recentActivityRaw,
    lowStockRows,
    expiringRows
  ] = await Promise.all([
    supabase.from('cats').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('health_tickets')
      .select('severity')
      .in('status', ['open', 'in_progress']),
    supabase.from('vaccinations')
      .select('id, vaccine_type, next_due_date, cat:cats(id, name)')
      .gte('next_due_date', todayStr)
      .lte('next_due_date', in30Days)
      .order('next_due_date', { ascending: true })
      .limit(10),
    supabase.from('preventive_treatments')
      .select('id, treatment_type, next_due_date, cat:cats(id, name)')
      .gte('next_due_date', todayStr)
      .lte('next_due_date', in30Days)
      .order('next_due_date', { ascending: true })
      .limit(10),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('vet_visits')
      .select('id, follow_up_date, visit_type, cat:cats(id, name)')
      .gte('follow_up_date', todayStr)
      .lte('follow_up_date', in14Days)
      .order('follow_up_date', { ascending: true })
      .limit(10),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('health_tickets')
      .select('id, title, created_at, severity, cat:cats(id, name)')
      .order('created_at', { ascending: false })
      .limit(8),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('stock_item_status')
      .select('stock_item_id, name, qty_on_hand, min_threshold, unit')
      .eq('is_active', true)
      .eq('is_low_stock', true)
      .order('name', { ascending: true })
      .limit(5),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('stock_expiring_batches')
      .select('batch_id, stock_item_id, item_name, qty_remaining, expiry_date, days_to_expiry, unit')
      .lte('days_to_expiry', 30)
      .order('days_to_expiry', { ascending: true })
      .limit(5)
  ]);

  const catsCount  = catsAgg.count  ?? 0;
  const roomsCount = roomsAgg.count ?? 0;
  const usersCount = usersAgg.count ?? 0;

  // Severity counts
  const sevCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (openTicketsBySeverity.data ?? []) as any[]) {
    if (t.severity in sevCounts) sevCounts[t.severity as keyof typeof sevCounts]++;
  }
  const totalOpen = sevCounts.low + sevCounts.medium + sevCounts.high + sevCounts.critical;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vacc = (upcomingVacc.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prev = (upcomingPrev.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const followups = (upcomingFollowups.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentTickets = (recentActivityRaw.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lowStock = (lowStockRows.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiring = (expiringRows.data ?? []) as any[];

  const stats = [
    { href: '/cats',  label: t('nav.cats'),  value: catsCount,  icon: Cat,  hint: ta('activeProfiles') },
    { href: '/rooms', label: t('nav.rooms'), value: roomsCount, icon: Home, hint: ta('activeRooms') },
    { href: '/users', label: t('nav.users'), value: usersCount, icon: Users, hint: ta('activeUsers') }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{ta('welcome', { name: user.profile.full_name })}</h1>
        <p className="text-sm text-muted-foreground">{ta('subtitle')}</p>
      </header>

      {/* Daily care tracker — every cat grouped by sitter */}
      <DailyProgressTracker />

      {/* Top stats */}
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

      {/* Health alerts row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Open tickets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
              {ta('openTickets')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{totalOpen}</div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {sevCounts.critical > 0 && (
                <span className="rounded px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {sevCounts.critical} critical
                </span>
              )}
              {sevCounts.high > 0 && (
                <span className="rounded px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  {sevCounts.high} high
                </span>
              )}
              {sevCounts.medium > 0 && (
                <span className="rounded px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {sevCounts.medium} medium
                </span>
              )}
              {sevCounts.low > 0 && (
                <span className="rounded px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {sevCounts.low} low
                </span>
              )}
              {totalOpen === 0 && <span className="text-muted-foreground">{ta('noOpenTickets')}</span>}
            </div>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href="/health-tickets">{ta('viewAll')} →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming vaccinations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Syringe className="h-4 w-4 text-muted-foreground" />
              {ta('upcomingVaccinations')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{vacc.length}</div>
            <ul className="space-y-1 text-xs">
              {vacc.length === 0 && <li className="text-muted-foreground">{ta('noneIn30')}</li>}
              {vacc.slice(0, 3).map((v) => (
                <li key={v.id} className="flex justify-between gap-2">
                  <span className="truncate">{v.cat?.name ?? '—'} · {v.vaccine_type}</span>
                  <span className="text-muted-foreground shrink-0">{formatDate(v.next_due_date)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Upcoming preventive */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {ta('upcomingPreventive')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{prev.length}</div>
            <ul className="space-y-1 text-xs">
              {prev.length === 0 && <li className="text-muted-foreground">{ta('noneIn30')}</li>}
              {prev.slice(0, 3).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{p.cat?.name ?? '—'} · {p.treatment_type}</span>
                  <span className="text-muted-foreground shrink-0">{formatDate(p.next_due_date)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Vet follow-ups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              {ta('vetFollowups')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{followups.length}</div>
            <ul className="space-y-1 text-xs">
              {followups.length === 0 && <li className="text-muted-foreground">{ta('noneIn14')}</li>}
              {followups.slice(0, 3).map((f) => (
                <li key={f.id} className="flex justify-between gap-2">
                  <span className="truncate">{f.cat?.name ?? '—'}</span>
                  <span className="text-muted-foreground shrink-0">{formatDate(f.follow_up_date)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              {ta('lowStock')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{lowStock.length}</div>
            <ul className="space-y-1 text-xs">
              {lowStock.length === 0 && <li className="text-muted-foreground">{ta('noLowStock')}</li>}
              {lowStock.slice(0, 3).map((row) => (
                <li key={row.stock_item_id} className="flex justify-between gap-2">
                  <span className="truncate">{row.name}</span>
                  <span className="text-muted-foreground shrink-0">{row.qty_on_hand} / {row.min_threshold}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href="/stock">{ta('viewAll')} →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Expiring stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {ta('expiringStock')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{expiring.length}</div>
            <ul className="space-y-1 text-xs">
              {expiring.length === 0 && <li className="text-muted-foreground">{ta('noExpiring')}</li>}
              {expiring.slice(0, 3).map((row) => (
                <li key={row.batch_id} className="flex justify-between gap-2">
                  <span className="truncate">{row.item_name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {row.days_to_expiry < 0 ? ta('expired') : `${row.days_to_expiry}d`}
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href="/stock">{ta('viewAll')} →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent tickets feed */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {ta('recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <p className="text-xs text-muted-foreground">{ta('noActivity')}</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {recentTickets.map((tk) => (
                  <li key={tk.id} className="flex justify-between gap-2 border-b last:border-0 pb-1">
                    <span className="truncate">
                      <span className="font-medium">{tk.cat?.name ?? '—'}</span> · {tk.title}
                    </span>
                    <span className="text-muted-foreground shrink-0">{formatDate(tk.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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
          <Button asChild variant="outline"><Link href="/reports">{ta('reports')}</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
