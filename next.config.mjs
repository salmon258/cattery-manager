import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from 'next-pwa';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Merge our custom push + background-sync handler into the workbox SW
  importScripts: ['/sw-custom.js'],
  runtimeCaching: [
    // Next.js JS/CSS build assets are content-hashed — safe to cache forever.
    // Serving these from cache removes the per-navigation bundle fetch that
    // otherwise gates route transitions on a cold network.
    {
      urlPattern: /\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // Next.js server-rendered routes (RSC payloads). StaleWhileRevalidate
    // lets the app shell paint instantly from cache on repeat navigations
    // while the SW refreshes the payload in the background.
    {
      urlPattern: /^https?.*\/_next\/data\//,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-data',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // Cache Supabase Storage images (cache-first, long TTL)
    {
      urlPattern: /^https?.*\.supabase\.(co|in)\/storage\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-images',
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // Google/Apple fonts etc.
    {
      urlPattern: /^https?.*\.(?:woff2?|ttf|otf|eot)(\?.*)?$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'fonts-cache',
        expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // GET API reads — stale-while-revalidate so the UI paints instantly
    // from cache and the fresh response lands in the next query refetch.
    // POST/PUT/PATCH/DELETE are never matched (workbox only caches GET).
    {
      urlPattern: /^https?.*\/api\/(?!auth|tasks\/.*\/confirm|.*\/confirm|.*\/mutate).*/,
      handler: 'StaleWhileRevalidate',
      method: 'GET',
      options: {
        cacheName: 'api-reads-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // Cache app pages network-first so offline works, but with a short
    // network-timeout so slow connections don't stall on the shell.
    {
      urlPattern: /^https?.*\/(cats|rooms|dashboard|my-cats|food-items|users|health-tickets|stock|breeding|finance|clinics|settings|profile|reports)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }
      }
    },
    // Default: network-first with a short network-timeout for anything else
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'default-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tree-shake heavy icon + date libs so route bundles stay small. Without
  // this, `import { Plus } from 'lucide-react'` still pulls the whole
  // package into the chunk.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-toast'
    ]
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' }
    ]
  }
};

export default withPWA(withNextIntl(nextConfig));
