'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Top-of-page loading bar that reacts to client-side navigation in the
 * App Router. We detect navigation starts by listening to same-origin link
 * clicks in the capture phase (so we run before Next.js calls
 * `preventDefault()` on the anchor) and by patching `history.pushState` /
 * `history.replaceState` so programmatic `router.push` also triggers the
 * bar. We end the bar once the committed pathname or search params change.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  // Safety valve: auto-hide after a maximum duration in case a navigation is
  // cancelled mid-flight and we never see a pathname change.
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startBar() {
    setLoading(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setLoading(false), 8000);
  }
  function stopBar() {
    setLoading(false);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  // End the bar once the new route has committed. `searchParams` is included
  // so query-string-only navigations are caught.
  useEffect(() => {
    stopBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    function isInternalNavigation(target: URL): boolean {
      if (target.origin !== window.location.origin) return false;
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      ) {
        return false;
      }
      return true;
    }

    function handleClick(e: MouseEvent) {
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
        if (isInternalNavigation(url)) startBar();
      } catch {
        /* ignore invalid URLs */
      }
    }

    // Capture phase: fires before Next.js's own click handler calls
    // `preventDefault()` on the anchor, so we can still see the intent even
    // though the default anchor navigation is suppressed.
    document.addEventListener('click', handleClick, true);

    // Patch history methods so programmatic navigation (router.push/replace)
    // also starts the bar. Next.js internally updates history via these two
    // after the RSC fetch completes, but we also rely on link-click detection
    // for the initial signal so we don't miss the whole transition window.
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args) {
      try {
        const nextUrl = args[2];
        if (nextUrl) {
          const url = new URL(String(nextUrl), window.location.href);
          if (isInternalNavigation(url)) startBar();
        }
      } catch {
        /* ignore */
      }
      return origPush.apply(this, args as Parameters<typeof origPush>);
    };
    window.history.replaceState = function (...args) {
      try {
        const nextUrl = args[2];
        if (nextUrl) {
          const url = new URL(String(nextUrl), window.location.href);
          if (isInternalNavigation(url)) startBar();
        }
      } catch {
        /* ignore */
      }
      return origReplace.apply(this, args as Parameters<typeof origReplace>);
    };

    // Back/forward button navigations
    function onPopState() {
      startBar();
    }
    window.addEventListener('popstate', onPopState);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', onPopState);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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
