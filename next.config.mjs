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
    // Cache pages (network-first, fall back to cache)
    {
      urlPattern: /^https?.*\/(cats|rooms|dashboard|my-cats)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }
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
    // Cache API reads (stale-while-revalidate for cat/room lists)
    {
      urlPattern: /^https?.*\/api\/(cats|rooms|food)/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-reads-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // Default: network-first for everything else
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'default-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
        networkTimeoutSeconds: 10
      }
    }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' }
    ]
  }
};

export default withPWA(withNextIntl(nextConfig));
