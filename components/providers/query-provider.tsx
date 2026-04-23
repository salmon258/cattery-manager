'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Treat cached data as fresh for 5 min so navigating back to a
            // previously-visited page paints immediately from cache with
            // no network round-trip. After that window, a stale remount
            // kicks off a background refetch but `isLoading` stays false
            // (since we already have data) — no spinner, no flicker.
            // Mutations invalidate specific keys so writes stay reflected.
            staleTime: 5 * 60_000,
            // Keep unused query data around for 30 min so instant revisits
            // still work for screens the user briefly left.
            gcTime: 30 * 60_000,
            // Firing a refetch every time the user alt-tabs creates the
            // "data flashes/re-loads" feel, especially on mobile where
            // visibilitychange fires on every foreground.
            refetchOnWindowFocus: false,
            // Show prior data while a new key (e.g. search term) is
            // fetching, so lists don't blank out between keystrokes.
            placeholderData: keepPreviousData,
            retry: 1
          }
        }
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
