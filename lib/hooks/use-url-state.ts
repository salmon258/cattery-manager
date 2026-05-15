'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Bind a piece of filter / search state to a URL query parameter.
 *
 * The URL is the source of truth: components read the current value
 * straight off `useSearchParams`, so navigating away and back (or
 * sharing the link) restores the same filter selection. Updates use
 * `router.replace`, so changing a filter doesn't push a new history
 * entry — Back still steps to the previous page rather than walking
 * through every filter tweak.
 *
 * Values that equal the default are stripped from the URL so the
 * common case stays a clean canonical link.
 *
 * @example
 *   const [q, setQ] = useUrlState('q', '');
 *   const [type, setType] = useUrlState<FoodType | 'all'>('type', 'all');
 *   const [showInactive, setShowInactive] = useUrlBoolState('inactive', false);
 */
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: NoInfer<T>,
  options?: { allowed?: readonly T[] }
): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = useMemo<T>(() => {
    const raw = searchParams.get(key);
    if (raw == null) return defaultValue;
    if (options?.allowed && !options.allowed.includes(raw as T)) return defaultValue;
    return raw as T;
  }, [searchParams, key, defaultValue, options?.allowed]);

  const setValue = useCallback(
    (next: T) => {
      // Read live URL state instead of the closure's `searchParams` so two
      // filter updates fired in the same tick don't clobber each other.
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue || next === '') {
        params.delete(key);
      } else {
        params.set(key, String(next));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [key, defaultValue, pathname, router]
  );

  return [value, setValue];
}

/**
 * Same contract as `useUrlState`, but the URL write is debounced.
 *
 * The returned `value` updates synchronously on every `set()` so the
 * controlled input stays snappy, while the actual `router.replace`
 * (which kicks off a full Next.js route re-render) only fires after
 * the user pauses typing. The third tuple element is `pending` — true
 * while a debounced update is queued, useful for showing a small
 * "searching…" indicator next to the input.
 *
 * Used for free-text search boxes where every keystroke would
 * otherwise call `router.replace` and freeze the page for the
 * duration of the route re-render.
 */
export function useDebouncedUrlState<T extends string = string>(
  key: string,
  defaultValue: NoInfer<T>,
  options?: { allowed?: readonly T[]; delay?: number }
): [T, (next: T) => void, boolean] {
  const delay = options?.delay ?? 300;
  const [urlValue, setUrlValue] = useUrlState<T>(key, defaultValue, options);
  const [localValue, setLocalValue] = useState<T>(urlValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Pull external URL changes (back/forward, programmatic nav) back into
  // the input — but only when the user isn't mid-edit, so we don't clobber
  // a debounced pending value.
  useEffect(() => {
    if (!dirtyRef.current) setLocalValue(urlValue);
  }, [urlValue]);

  // Clear the timer on unmount so we don't fire a router.replace after the
  // page has navigated away.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const setValue = useCallback(
    (next: T) => {
      setLocalValue(next);
      dirtyRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        dirtyRef.current = false;
        setUrlValue(next);
      }, delay);
    },
    [setUrlValue, delay]
  );

  const pending = localValue !== urlValue;
  return [localValue, setValue, pending];
}

/** Boolean flag mirrored to a `?key=1` style param. */
export function useUrlBoolState(
  key: string,
  defaultValue = false
): [boolean, (next: boolean) => void] {
  const [raw, setRaw] = useUrlState(key, defaultValue ? '1' : '0', {
    allowed: ['0', '1'] as const
  });
  const value = raw === '1';
  const setValue = useCallback((next: boolean) => setRaw(next ? '1' : '0'), [setRaw]);
  return [value, setValue];
}
