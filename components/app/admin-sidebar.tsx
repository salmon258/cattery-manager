'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Cat,
  HeartPulse,
  Home,
  Users,
  Utensils,
  Dna,
  Stethoscope,
  BarChart3,
  Settings,
  Package,
  type LucideIcon
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase/aliases';
import { Badge } from '@/components/ui/badge';
import { UserMenu } from '@/components/app/user-menu';
import { PushOptIn } from '@/components/pwa/push-opt-in';
import { InstallPrompt } from '@/components/pwa/install-prompt';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Tailwind text color used for the icon so the sidebar reads as colorful. */
  iconColor?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

interface Props {
  profile: Profile;
  brandName: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ profile, brandName, onNavigate }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const ta = useTranslations('adminNav');

  const { data: openTicketCount = 0 } = useQuery({
    queryKey: ['health-tickets-count'],
    queryFn: async () => {
      const r = await fetch('/api/health-tickets?count_only=1');
      if (!r.ok) return 0;
      return ((await r.json()).count as number) ?? 0;
    },
    staleTime: 60_000
  });

  const sections: NavSection[] = [
    {
      label: ta('sectionOverview'),
      items: [{ href: '/', label: t('dashboard'), icon: LayoutDashboard, iconColor: 'text-violet-500' }]
    },
    {
      label: ta('sectionManage'),
      items: [
        { href: '/cats', label: t('cats'), icon: Cat, iconColor: 'text-fuchsia-500' },
        { href: '/health-tickets', label: t('healthTickets'), icon: HeartPulse, iconColor: 'text-rose-500', badge: openTicketCount || undefined },
        { href: '/clinics', label: t('clinics'), icon: Stethoscope, iconColor: 'text-sky-500' },
        { href: '/breeding', label: t('breeding'), icon: Dna, iconColor: 'text-pink-500' },
        { href: '/rooms', label: t('rooms'), icon: Home, iconColor: 'text-teal-500' },
        { href: '/food-items', label: t('food'), icon: Utensils, iconColor: 'text-amber-500' },
        { href: '/stock', label: t('stock'), icon: Package, iconColor: 'text-lime-500' }
      ]
    },
    {
      label: ta('sectionAccess'),
      items: [{ href: '/users', label: t('users'), icon: Users, iconColor: 'text-indigo-500' }]
    },
    {
      label: ta('sectionInsights'),
      items: [
        { href: '/reports', label: t('reports'), icon: BarChart3, iconColor: 'text-emerald-500' },
        { href: '/settings', label: t('settings'), icon: Settings, iconColor: 'text-slate-500' }
      ]
    }
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <aside className="flex h-full w-full flex-col bg-gradient-to-b from-violet-50/60 via-background to-fuchsia-50/40 dark:from-violet-950/40 dark:via-background dark:to-fuchsia-950/20">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white shadow-sm">
          <Cat className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-600 bg-clip-text text-sm font-semibold leading-tight text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-rose-300">
            {brandName}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {ta('panelLabel')}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm'
                          : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-white' : item.iconColor ?? 'text-muted-foreground'
                        )}
                      />
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge ? (
                        <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* PWA prompts */}
      <div className="space-y-2 border-t px-3 py-3">
        <InstallPrompt />
        <PushOptIn />
      </div>

      {/* User */}
      <div className="flex items-center gap-3 border-t bg-background/50 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{profile.full_name}</div>
          <div className="truncate text-xs text-muted-foreground">{ta('adminBadge')}</div>
        </div>
        <UserMenu profile={profile} />
      </div>
    </aside>
  );
}
