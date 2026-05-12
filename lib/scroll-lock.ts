// Vaul and Radix Dialog lock <body> scroll while a drawer or dialog is open.
// They set position/top/left/right/height + an `overflow:hidden` style and
// also rely on the `data-scroll-locked` attribute applied by
// `react-remove-scroll-bar` (used internally by Radix), which triggers a
// global CSS rule `body[data-scroll-locked] { overflow: hidden !important }`.
//
// Their close-animation cleanup can race with route changes, `router.refresh()`,
// and React Query cache invalidations, leaving the body styles or the
// `data-scroll-locked` attribute behind and freezing the page. These helpers
// are the defense-in-depth.

function stripBodyLockStyles() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.style.removeProperty('overflow');
  body.style.removeProperty('position');
  body.style.removeProperty('top');
  body.style.removeProperty('left');
  body.style.removeProperty('right');
  body.style.removeProperty('height');
  body.style.removeProperty('pointer-events');
  body.removeAttribute('data-scroll-locked');

  const html = document.documentElement;
  html.style.removeProperty('overflow');
  html.style.removeProperty('scroll-behavior');
}

/**
 * Conservative release: only strips the body lock styles if no overlay is
 * actually open. Safe to call after route changes — if a new overlay
 * legitimately opens on the destination page, it re-applies its own lock.
 */
export function releaseScrollLockIfIdle() {
  if (typeof document === 'undefined') return;

  const stillOpen = document.querySelector(
    '[data-vaul-drawer][data-state="open"], [role="dialog"][data-state="open"]'
  );
  if (stillOpen) return;

  stripBodyLockStyles();
}

/**
 * Aggressive release: strips the body lock styles unconditionally. Use after
 * a pull-to-refresh, where the user just performed a touch gesture on the
 * page itself — so any lingering "open" state attribute is stale and any
 * lock must be cleared. (The conservative variant misses cases where
 * Radix Popover content keeps `role="dialog"` + `data-state="open"` in the
 * DOM during its close animation, or where vaul leaves `height: auto` on
 * <body> after the route re-renders.)
 */
export function forceReleaseScrollLock() {
  stripBodyLockStyles();
}
