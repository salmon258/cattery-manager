'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Top-of-page loading bar that reacts to client-side navigation in the
 * App Router. We detect navigation starts by listening to same-origin link
 * clicks and patching `history.pushState` / `history.replaceState` (the
 * primitives used by `useRouter().push/replace`). We end the bar whenever
 * the committed pathname or search params actually change.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  // End the bar once the new route has committed.
  useEffect(() => {
    setLoading(false);
    // `searchParams` is included so query-string-only navigations are caught.
  }, [pathname, searchParams]);

  useEffect(() => {
    function startIfNavigation(target: URL) {
      if (target.origin !== window.location.origin) return;
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      ) {
        return;
      }
      setLoading(true);
    }

    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      try {
        const url = new URL(href, window.location.href);
        startIfNavigation(url);
      } catch {
        /* ignore invalid URLs */
      }
    }

    document.addEventListener('click', handleClick);

    // Patch history methods so programmatic navigation (router.push/replace)
    // also starts the bar.
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args) {
      try {
        const nextUrl = args[2];
        if (nextUrl) startIfNavigation(new URL(String(nextUrl), window.location.href));
      } catch {
        /* ignore */
      }
      return origPush.apply(this, args as Parameters<typeof origPush>);
    };
    window.history.replaceState = function (...args) {
      try {
        const nextUrl = args[2];
        if (nextUrl) startIfNavigation(new URL(String(nextUrl), window.location.href));
      } catch {
        /* ignore */
      }
      return origReplace.apply(this, args as Parameters<typeof origReplace>);
    };

    return () => {
      document.removeEventListener('click', handleClick);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  if (!loading) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-transparent"
      aria-hidden
    >
      <div className="nav-progress-bar h-full w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 shadow-[0_0_8px_rgba(217,70,239,0.6)]" />
    </div>
  );
}
