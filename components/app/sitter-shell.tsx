'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Cat, ListChecks, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase/aliases';
import { UserMenu } from '@/components/app/user-menu';
import { PushOptIn } from '@/components/pwa/push-opt-in';

interface Props {
  profile: Profile;
  brandName: string;
  children: React.ReactNode;
}

export function SitterShell({ profile, brandName, children }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const ts = useTranslations('sitterNav');

  const tabs = [
    {
      href: '/my-cats',
      label: ts('myCats'),
      icon: ListChecks,
      activeText: 'text-violet-600 dark:text-violet-400',
      activeBg: 'bg-violet-100 dark:bg-violet-950/50'
    },
    {
      href: '/cats',
      label: ts('allCats'),
      icon: Cat,
      activeText: 'text-sky-600 dark:text-sky-400',
      activeBg: 'bg-sky-100 dark:bg-sky-950/50'
    },
    {
      href: '/profile',
      label: ts('profile'),
      icon: User,
      activeText: 'text-rose-600 dark:text-rose-400',
      activeBg: 'bg-rose-100 dark:bg-rose-950/50'
    }
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-violet-50/40 via-background to-sky-50/40 dark:from-violet-950/20 dark:via-background dark:to-sky-950/20">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
        <Link href="/my-cats" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white shadow-sm">
            <Cat className="h-4 w-4" />
          </div>
          <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-600 bg-clip-text font-semibold text-transparent dark:from-violet-400 dark:via-fuchsia-400 dark:to-rose-400">
            {brandName}
          </span>
        </Link>
        <UserMenu profile={profile} />
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-4 pb-24">{children}</div>
      </main>

      {/* PWA: push opt-in banner shown once at top of content area */}
      <div className="mx-auto max-w-3xl px-4 pt-2">
        <PushOptIn />
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-3xl items-stretch">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  className={cn(
                    'mx-1 my-1 flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] transition-all',
                    active
                      ? cn(tab.activeText, tab.activeBg, 'font-semibold shadow-sm')
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && tab.activeText)} />
                  <span className="truncate">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
