if (!self.define) {
  let s,
    e = {};
  const c = (c, a) => (
    (c = new URL(c + ".js", a).href),
    e[c] ||
      new Promise((e) => {
        if ("document" in self) {
          const s = document.createElement("script");
          ((s.src = c), (s.onload = e), document.head.appendChild(s));
        } else ((s = c), importScripts(c), e());
      }).then(() => {
        let s = e[c];
        if (!s) throw new Error(`Module ${c} didn’t register its module`);
        return s;
      })
  );
  self.define = (a, n) => {
    const i =
      s ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (e[i]) return;
    let t = {};
    const r = (s) => c(s, i),
      l = { module: { uri: i }, exports: t, require: r };
    e[i] = Promise.all(a.map((s) => l[s] || r(s))).then((s) => (n(...s), t));
  };
}
define(["./workbox-87b8d583"], function (s) {
  "use strict";
  (importScripts("/sw-custom.js"),
    self.skipWaiting(),
    s.clientsClaim(),
    s.precacheAndRoute(
      [
        {
          url: "/_next/app-build-manifest.json",
          revision: "3655f4c8bc2a3ed566eb26d3d252be98",
        },
        {
          url: "/_next/static/chunks/1-60d9186770c9c90b.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/21-44523285aa82a9a9.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/216-3dfbf79925c17472.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/317-01babac2fdc659bb.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/438-6cb4186d3e8018db.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/44530001-8088a941397058c2.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/551-2ce359076af23eb8.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/589-51b2e84d494bd689.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/59-91af22a5034d5108.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/619-06bb80ebb4cb3118.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/667-fe6adcc8abf04d74.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/708-894b43d8ff35cdd5.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/713-b76e2250d90a01c2.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/748-377efef6071c5469.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/858-15808713ac25eda3.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/955-59de0aa5f020acc2.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/966-d628fef9e0cda9ae.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/972-bb0287a3af965210.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/cats/%5Bid%5D/page-3d5808e0820d7b20.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/cats/new/page-f309f01f3c7528e0.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/cats/page-41eef8f1e907d25a.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/food-items/page-9408da0e5e8b0d80.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/health-tickets/page-e6630a980a5aebfb.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/layout-144cedba66194263.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/my-cats/page-7fc5ab08d7988449.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/page-97de600ddf406629.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/profile/page-17a25672f54da4c4.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/rooms/%5Bid%5D/page-9a38f7e4e4775d47.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/rooms/page-5f446624c781ece7.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/(app)/users/page-59642f19dc2b9592.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/_not-found/page-c7f83d2d8f20d5de.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/layout-627fae660e44b427.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/app/login/page-8bfc99f9c60837fc.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/fd9d1056-1c6c076a67def79f.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/framework-f66176bb897dc684.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/main-4aad713995cf8249.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/main-app-e8c0061650e5db23.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/pages/_app-72b849fbd24ac258.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/pages/_error-7ba65e1336b92748.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/chunks/polyfills-42372ed130431b0a.js",
          revision: "846118c33b2c0e922d7b3a7676f81f6f",
        },
        {
          url: "/_next/static/chunks/webpack-de96603576ac7c02.js",
          revision: "e5kcJZcSYJQmlCKsZJAFU",
        },
        {
          url: "/_next/static/css/9aafc940ec95d854.css",
          revision: "9aafc940ec95d854",
        },
        {
          url: "/_next/static/e5kcJZcSYJQmlCKsZJAFU/_buildManifest.js",
          revision: "c155cce658e53418dec34664328b51ac",
        },
        {
          url: "/_next/static/e5kcJZcSYJQmlCKsZJAFU/_ssgManifest.js",
          revision: "b6652df95db52feb4daf4eca35380933",
        },
        {
          url: "/icons/icon@1x.png",
          revision: "5cc2058c6dd26ad115623423116c3391",
        },
        {
          url: "/icons/icon-192.svg",
          revision: "c78b01b1f1277ddf02415581ee972b08",
        },
        {
          url: "/icons/icon-512.png",
          revision: "9473dea200e06a02f0785fa18dba827c",
        },
        {
          url: "/icons/icon-512.svg",
          revision: "9ee85ddbdabc3de89fa85722d029179d",
        },
        { url: "/manifest.json", revision: "f85ebd27c9d4af5c20722f0a060c7343" },
        {
          url: "/splashscreens/splash-1125x2436.png",
          revision: "5892c7c090cb3b16d27caed91a3a5fe1",
        },
        {
          url: "/splashscreens/splash-1242x2688.png",
          revision: "683e7614b063770109785636434efd10",
        },
        {
          url: "/splashscreens/splash-640x1136.png",
          revision: "e1c7c0913eaf3a92c4e1c38a6d33cbbe",
        },
        {
          url: "/splashscreens/splash-750x1334.png",
          revision: "1c34babb1ed1a5cc5d6c34199581ce21",
        },
        {
          url: "/splashscreens/splash-828x1792.png",
          revision: "5eb60fd46516787e725d58bf40c43919",
        },
        { url: "/sw-custom.js", revision: "fbef05ef4a58506d0b54f84356603a97" },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    s.cleanupOutdatedCaches(),
    s.registerRoute(
      "/",
      new s.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({
              request: s,
              response: e,
              event: c,
              state: a,
            }) =>
              e && "opaqueredirect" === e.type
                ? new Response(e.body, {
                    status: 200,
                    statusText: "OK",
                    headers: e.headers,
                  })
                : e,
          },
        ],
      }),
      "GET",
    ),
    s.registerRoute(
      /^https?.*\/(cats|rooms|dashboard|my-cats)/,
      new s.NetworkFirst({
        cacheName: "pages-cache",
        plugins: [
          new s.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    s.registerRoute(
      /^https?.*\.supabase\.(co|in)\/storage\//,
      new s.CacheFirst({
        cacheName: "supabase-images",
        plugins: [
          new s.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 }),
          new s.CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
      "GET",
    ),
    s.registerRoute(
      /^https?.*\/api\/(cats|rooms|food)/,
      new s.StaleWhileRevalidate({
        cacheName: "api-reads-cache",
        plugins: [
          new s.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 3600 }),
          new s.CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
      }),
      "GET",
    ),
    s.registerRoute(
      /^https?.*/,
      new s.NetworkFirst({
        cacheName: "default-cache",
        networkTimeoutSeconds: 10,
        plugins: [
          new s.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ));
});
