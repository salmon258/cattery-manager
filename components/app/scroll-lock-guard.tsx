'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Vaul and Radix Dialog lock <body> scroll (overflow / position:fixed /
// pointer-events / data-scroll-locked) while a drawer or dialog is open, and
// rely on an unmount-time effect cleanup to restore it. When a page with an
// open — or still-animating-closed — overlay unmounts because the user
// navigates away, that cleanup can race with the route change and leave the
// styles behind, which freezes the next page (the reported symptom: opening a
// modal on a cat detail page then going back to the dashboard makes the
// dashboard unscrollable).
//
// After each pathname change, once any in-flight close animation has had a
// frame or two to finish, reset the body styles if no overlay is actually
// open. Safe as a defense-in-depth: if a new overlay legitimately opens on
// the destination page, it re-applies its own lock.
export function ScrollLockGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stillOpen = document.querySelector(
        '[data-vaul-drawer][data-state="open"], [role="dialog"][data-state="open"]'
      );
      if (stillOpen) return;

      const body = document.body;
      body.style.removeProperty('overflow');
      body.style.removeProperty('position');
      body.style.removeProperty('top');
      body.style.removeProperty('left');
      body.style.removeProperty('right');
      body.style.removeProperty('pointer-events');
      body.removeAttribute('data-scroll-locked');

      const html = document.documentElement;
      html.style.removeProperty('overflow');
      html.style.removeProperty('scroll-behavior');
    }, 150);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
