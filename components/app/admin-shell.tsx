'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Menu, Cat } from 'lucide-react';
import { Drawer, DrawerContent, DrawerPortal, DrawerOverlay } from '@/components/ui/drawer';
import { DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { AdminSidebar } from '@/components/app/admin-sidebar';
import type { Profile } from '@/lib/supabase/aliases';

interface Props {
  profile: Profile;
  brandName: string;
  children: React.ReactNode;
}

export function AdminShell({ profile, brandName, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer automatically on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/60 via-background to-rose-50/40 dark:from-violet-950/30 dark:via-background dark:to-rose-950/20">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r md:block">
        <AdminSidebar profile={profile} brandName={brandName} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white shadow-sm">
              <Cat className="h-4 w-4" />
            </div>
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-600 bg-clip-text font-semibold text-transparent dark:from-violet-400 dark:via-fuchsia-400 dark:to-rose-400">
              {brandName}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Drawer
        direction="left"
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        shouldScaleBackground={false}
      >
        <DrawerPortal>
          <DrawerOverlay />
          <DrawerContent className="left-0 right-auto top-0 mt-0 flex h-full max-h-screen w-72 rounded-none rounded-r-lg border-r p-0">
            <DrawerTitle className="sr-only">Navigation</DrawerTitle>
            <AdminSidebar
              profile={profile}
              brandName={brandName}
              onNavigate={() => setMobileOpen(false)}
            />
          </DrawerContent>
        </DrawerPortal>
      </Drawer>

      {/* Content */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
