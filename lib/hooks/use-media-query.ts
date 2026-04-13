'use client';
import { useEffect, useState } from 'react';

/**
 * Reads a CSS media query and stays in sync with changes.
 *
 * Initializes synchronously from `window.matchMedia` when possible so the first
 * render already reflects the correct value. This prevents a mount-time visual
 * flicker where a desktop viewport briefly renders the mobile branch (or vice
 * versa) before the effect runs — the main cause of the "sheet jumping" when
 * opening modals on desktop.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
