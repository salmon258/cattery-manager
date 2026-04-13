import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { NavigationProgress } from '@/components/app/navigation-progress';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Onatuchi Cattery Manager',
  description: 'Cattery Management System — track cats, health, feeding, and medications.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Onatuchi'
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Onatuchi',
    // Apple touch icon
    'apple-touch-icon': '/icons/icon-192.png',
    // Splash screens (common iOS resolutions)
    'apple-touch-startup-image-1125x2436': '/splashscreens/splash-1125x2436.png',
    'apple-touch-startup-image-1242x2688': '/splashscreens/splash-1242x2688.png',
    'apple-touch-startup-image-828x1792':  '/splashscreens/splash-828x1792.png',
    'apple-touch-startup-image-750x1334':  '/splashscreens/splash-750x1334.png',
    'apple-touch-startup-image-640x1136':  '/splashscreens/splash-640x1136.png'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' }
  ]
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* iOS splash screen links (link tags can't be expressed in Next.js metadata.other) */}
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/splashscreens/splash-1125x2436.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" href="/splashscreens/splash-1242x2688.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/splashscreens/splash-828x1792.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/splashscreens/splash-750x1334.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" href="/splashscreens/splash-640x1136.png" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
              <Suspense fallback={null}>
                <NavigationProgress />
              </Suspense>
              {children}
              <Toaster richColors position="top-right" />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
