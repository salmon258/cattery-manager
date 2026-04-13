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
      items: [{ href: '/', label: t('dashboard'), icon: LayoutDashboard }]
    },
    {
      label: ta('sectionManage'),
      items: [
        { href: '/cats', label: t('cats'), icon: Cat },
        { href: '/health-tickets', label: t('healthTickets'), icon: HeartPulse, badge: openTicketCount || undefined },
        { href: '/rooms', label: t('rooms'), icon: Home },
        { href: '/food-items', label: t('food'), icon: Utensils }
      ]
    },
    {
      label: ta('sectionAccess'),
      items: [{ href: '/users', label: t('users'), icon: Users }]
    }
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <aside className="flex h-full w-full flex-col bg-muted/40">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <Cat className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">{brandName}</span>
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
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? '' : 'text-muted-foreground group-hover:text-foreground'
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
