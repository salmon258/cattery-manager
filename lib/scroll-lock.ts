// Vaul and Radix Dialog lock <body> scroll (overflow / position:fixed /
// pointer-events / data-scroll-locked) while a drawer or dialog is open and
// rely on their close-animation cleanup to put those styles back. That
// cleanup can race with route changes, router.refresh(), and React Query
// invalidations, leaving the styles behind and freezing the page. This
// helper is the defense-in-depth: if nothing is actually open, rip the
// styles off <body>/<html>. If something legitimate is open, bail — the
// overlay will re-apply its own lock on the next render.
export function releaseScrollLockIfIdle() {
  if (typeof document === 'undefined') return;

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
}
