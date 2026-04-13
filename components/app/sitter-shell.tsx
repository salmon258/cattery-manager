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
    { href: '/my-cats', label: ts('myCats'), icon: ListChecks },
    { href: '/cats', label: ts('allCats'), icon: Cat },
    { href: '/profile', label: ts('profile'), icon: User }
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <Link href="/my-cats" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Cat className="h-4 w-4" />
          </div>
          <span className="font-semibold">{brandName}</span>
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
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur"
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
                    'flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'text-primary')} />
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
