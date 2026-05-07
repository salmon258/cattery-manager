'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createStore, get, set, del } from 'idb-keyval';
import { createClient } from '@/lib/supabase/client';

// Bump to invalidate every persisted cache on the device (e.g. after a
// breaking query-shape change). Unrelated to app version / deploy hash.
// v2: eating_log_items gained `quantity_eaten_g`. Pre-bump caches
// don't have the field, so meal lists rendered straight from IDB
// without a refetch (30-min staleTime) showed eaten = 0 / given.
const CACHE_BUSTER = 'v2';

const ONE_MIN = 60_000;
const ONE_HOUR = 60 * ONE_MIN;
const ONE_DAY = 24 * ONE_HOUR;

function createIdbPersister(): Persister | null {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return null;
  }
  try {
    const store = createStore('cattery-manager-query-cache', 'queries');
    return createAsyncStoragePersister({
      storage: {
        getItem: async (key) => (await get<string>(key, store)) ?? null,
        setItem: async (key, value) => set(key, value, store),
        removeItem: async (key) => del(key, store)
      },
      key: 'tanstack-query',
      throttleTime: 1000
    });
  } catch {
    return null;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 30 min. Revisits within the window paint
            // instantly from the (in-memory or IDB-restored) cache with zero
            // network. Past 30 min a mounted query fires a background
            // refetch — `isLoading` stays false because data is already
            // present, so the UI shows cached data and swaps in fresh data
            // when the request lands (stale-while-revalidate).
            staleTime: 30 * ONE_MIN,
            // Keep unused queries in memory for 24h so the persister has a
            // snapshot to dehydrate on page hide / app close.
            gcTime: ONE_DAY,
            // Don't refetch on every alt-tab — disruptive on mobile.
            refetchOnWindowFocus: false,
            // Do catch up after a network drop (PWA on mobile).
            refetchOnReconnect: true,
            // Show prior data while a new key (search term, filter) loads.
            placeholderData: keepPreviousData,
            retry: 1,
            // New in @tanstack/react-query 5.100: `retryOnMount` takes a
            // predicate over the whole query. When a component remounts
            // with a cached error, retrying a 4xx (auth, forbidden, not
            // found) request will fail the same way and just waste a
            // round-trip. Bounce those; keep retrying 5xx/network errors
            // where a fresh attempt has a chance.
            retryOnMount: (query) => {
              const err = query.state.error as (Error & { status?: number }) | null;
              if (!err) return true;
              const status = typeof err.status === 'number' ? err.status : undefined;
              if (status && status >= 400 && status < 500) return false;
              return true;
            }
          }
        }
      })
  );

  const [persister] = useState(createIdbPersister);

  // Cached data belongs to a specific user. On sign-out, purge everything so
  // the next user can't momentarily see the previous user's cats/rooms from
  // IndexedDB before the first refetch replaces it.
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        client.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const devtools = process.env.NODE_ENV === 'development' ? (
    <ReactQueryDevtools initialIsOpen={false} />
  ) : null;

  if (!persister) {
    return (
      <QueryClientProvider client={client}>
        {children}
        {devtools}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        // Drop anything older than a day — matches gcTime so we don't hold
        // arbitrarily stale snapshots across app upgrades.
        maxAge: ONE_DAY,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          // Only persist successful queries. Errors/pending states should
          // re-fetch fresh next time.
          shouldDehydrateQuery: (q) => q.state.status === 'success'
        }
      }}
    >
      {children}
      {devtools}
    </PersistQueryClientProvider>
  );
}
