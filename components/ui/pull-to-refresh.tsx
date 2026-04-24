'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { releaseScrollLockIfIdle } from '@/lib/scroll-lock';

const THRESHOLD = 70;
const MAX_PULL = 110;
const DAMPING = 0.55;

/**
 * Pull-to-refresh wrapper for the main scroll area.
 *
 * Attached to window scroll/touch events so it works for all routes
 * that scroll the document (both admin and sitter shells do). It only
 * engages when the page is already scrolled to the very top and the
 * user drags down a meaningful amount — normal taps and vertical
 * scrolling are left untouched. When a modal / drawer is open we
 * bail out so we don't fight vaul's drag-to-close gesture.
 *
 * On refresh we invalidate every active React Query cache entry and
 * also call `router.refresh()` so server-rendered pages (e.g. the
 * dashboard) pick up fresh data too.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [animating, setAnimating] = useState(false);

  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const distanceRef = useRef(0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      router.refresh();
      await qc.invalidateQueries();
      // Small floor so the spinner is visible even on very fast responses.
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      setRefreshing(false);
      setDistance(0);
      distanceRef.current = 0;
      // router.refresh() + invalidateQueries() can re-render in place while a
      // Vaul drawer or Radix dialog is mid-close-animation, racing its
      // scroll-lock cleanup and leaving <body> frozen. ScrollLockGuard only
      // fires on pathname change, so clear the lock here too.
      window.setTimeout(releaseScrollLockIfIdle, 150);
    }
  }, [qc, router]);

  useEffect(() => {
    function isBlocked(target: EventTarget | null): boolean {
      if (refreshing) return true;
      if (!(target instanceof Element)) return false;
      // Don't interfere while a dialog / drawer / popover is open.
      if (target.closest('[role="dialog"], [data-vaul-drawer], [data-radix-popper-content-wrapper]')) {
        return true;
      }
      return !!document.querySelector(
        '[data-vaul-drawer][data-state="open"], [role="dialog"][data-state="open"]'
      );
    }

    function onTouchStart(e: TouchEvent) {
      if (isBlocked(e.target)) {
        startY.current = null;
        return;
      }
      if (e.touches.length !== 1) {
        startY.current = null;
        return;
      }
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      active.current = false;
      setAnimating(false);
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (window.scrollY > 0 || dy <= 0) {
        if (active.current) {
          active.current = false;
          setAnimating(true);
          setDistance(0);
          distanceRef.current = 0;
        }
        startY.current = null;
        return;
      }
      // Only hijack the gesture once the user has clearly pulled down,
      // so short taps and horizontal swipes are unaffected.
      if (!active.current) {
        if (dy < 10) return;
        active.current = true;
        setAnimating(false);
      }
      if (e.cancelable) e.preventDefault();
      const damped = Math.min(MAX_PULL, dy * DAMPING);
      distanceRef.current = damped;
      setDistance(damped);
    }

    function onTouchEnd() {
      if (!active.current) {
        startY.current = null;
        return;
      }
      const d = distanceRef.current;
      active.current = false;
      startY.current = null;
      setAnimating(true);
      if (d >= THRESHOLD) {
        void refresh();
      } else {
        setDistance(0);
        distanceRef.current = 0;
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [refresh, refreshing]);

  const visible = refreshing ? THRESHOLD : distance;
  const progress = Math.min(1, distance / THRESHOLD);
  const showIndicator = visible > 0 || refreshing;

  return (
    <>
      {showIndicator && (
        <div
          aria-hidden={!refreshing && distance < THRESHOLD / 2}
          className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
          style={{
            transform: `translateY(${Math.max(0, visible - 36)}px)`,
            transition: animating ? 'transform 220ms ease-out' : 'none'
          }}
        >
          <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border bg-background/95 shadow-sm backdrop-blur">
            <RefreshCw
              className={cn(
                'h-4 w-4 text-violet-600 dark:text-violet-400',
                refreshing && 'animate-spin'
              )}
              style={
                refreshing
                  ? undefined
                  : { transform: `rotate(${progress * 270}deg)`, transition: animating ? 'transform 220ms ease-out' : 'none' }
              }
            />
          </div>
        </div>
      )}
      <div
        style={{
          transform: `translateY(${visible}px)`,
          transition: animating ? 'transform 220ms ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </>
  );
}
