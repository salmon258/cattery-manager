# Phase 7 — PWA — Handoff

**Completed by:** Claude (Opus 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §13 (PWA Configuration), §12.2 (Push Notifications), §16.3 phase table

---

## What Was Built

### Infrastructure
- [x] **`next-pwa` + Workbox** — `next.config.mjs` wrapped with `withPWA`. Disabled in development, active in production. Runtime caching strategies:
  - Pages (`/cats`, `/rooms`, `/dashboard`, `/my-cats`): NetworkFirst, 24h TTL
  - Supabase Storage images: CacheFirst, 7-day TTL
  - API reads (`/api/cats`, `/api/rooms`, `/api/food`): StaleWhileRevalidate, 1h TTL
  - Everything else: NetworkFirst with 10s network timeout fallback
- [x] **Web App Manifest** — `public/manifest.json`: app name "Onatuchi Cattery Manager", short name "Onatuchi", `display: standalone`, theme color `#000000`, two icon sizes (192px / 512px), two shortcuts (My Cats, All Cats).
- [x] **Placeholder icons** — `public/icons/icon-192.png` and `public/icons/icon-512.png` (dark zinc background, 192×192 and 512×512). Replace with production artwork before launch.
- [x] **iOS splash screens** — `public/splashscreens/splash-{W}x{H}.png` for five common iPhone resolutions (1125×2436, 1242×2688, 828×1792, 750×1334, 640×1136). Placeholder dark-background PNGs — replace with branded artwork.
- [x] **Root layout updated** — `app/layout.tsx`: `manifest` link, `apple-web-app-capable` meta, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, `<link rel="apple-touch-startup-image" media="...">` for each splash size.

### Push Notifications
- [x] **VAPID keys env** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` added to `.env.example`. Keys must be generated and added to `.env.local` (and Vercel secrets in prod).
- [x] **DB migration** — `supabase/migrations/20260418000000_phase7_pwa.sql`:
  - `push_subscriptions` table (one row per device per user, unique on `endpoint`)
  - `background_sync_queue` table (offline action store, `processed` flag)
  - RLS: users manage own subscriptions; admins can read all (for fan-out)
- [x] **Subscribe API** — `POST /api/push/subscribe` — upserts subscription on endpoint conflict
- [x] **Unsubscribe API** — `POST /api/push/unsubscribe` — removes subscription for the requesting user
- [x] **Send API** — `POST /api/push/send` — admin-only; accepts `{ user_id?, title, body, url }`, fans out via `web-push`, auto-removes 410-Gone subscriptions
- [x] **`lib/push/client.ts`** — `subscribeToPush()`, `registerPushSubscription()`, `unregisterPushSubscription()`, `isPushSupported()`
- [x] **`<PushOptIn>`** — `components/pwa/push-opt-in.tsx` — shown in both Admin sidebar and Sitter shell. States: idle (prompt), subscribed (green indicator + disable button), denied (hidden), unsupported (hidden). Dismissible X button.
- [x] **`<InstallPrompt>`** — `components/pwa/install-prompt.tsx` — listens for `beforeinstallprompt`, shown in Admin sidebar only. Dismissible.

### Background Sync (offline task confirms)
- [x] **Custom service worker** — `public/sw-custom.js` imported via `next-pwa`'s `importScripts`. Handles:
  - `push` event → `showNotification()` with icon + badge
  - `notificationclick` → focus/open window at `notification.data.url`
  - `sync` event tag `task-confirms` → `flushPendingActions()` which POSTs queued items to `/api/sync/flush`
  - IndexedDB store `cattery-sync / pending-actions` for offline queue
- [x] **Flush API** — `POST /api/sync/flush` — processes `confirm_task` actions (sets `confirmed_at`, `confirmed_by`, clears `skip_reason`)
- [x] **`lib/push/background-sync.ts`** — `confirmTaskWithFallback(taskId)`: if online → direct POST; if offline → queue to IndexedDB + register `SyncManager` tag

### Shell integrations
- Admin sidebar (`components/app/admin-sidebar.tsx`): `<InstallPrompt>` + `<PushOptIn>` above the user row
- Sitter shell (`components/app/sitter-shell.tsx`): `<PushOptIn>` banner above main content area

---

## Migration: apply before testing

```bash
supabase db push
# or for local:
supabase migration up
```

Then re-run types and re-append the aliases block:
```bash
supabase gen types typescript --local > lib/supabase/types.ts
# Re-append aliases block from phase-05-06-handoff or types.ts bottom
```

Add to `lib/supabase/types.ts` aliases block after regen:
```ts
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type BackgroundSyncQueue = Database['public']['Tables']['background_sync_queue']['Row']
```

Then remove the `as any` casts in `app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts`, and `app/api/push/send/route.ts`.

---

## Environment variables required

```env
# Generate with: node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k)"
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_public_key>
VAPID_PRIVATE_KEY=<your_private_key>
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

---

## Production checklist before launch

| Item | Status |
|---|---|
| Replace `public/icons/icon-192.png` with real brand artwork | ⬜ Todo |
| Replace `public/icons/icon-512.png` with real brand artwork | ⬜ Todo |
| Replace `public/splashscreens/*.png` with branded splash screens | ⬜ Todo |
| Set VAPID env vars in Vercel / hosting | ⬜ Todo |
| Apply migration to prod Supabase | ⬜ Todo |
| Test install prompt on Android Chrome | ⬜ Todo |
| Test "Add to Home Screen" on iOS Safari | ⬜ Todo |
| Test push notification delivery (subscribe → send via `/api/push/send`) | ⬜ Todo |
| Test offline task confirm → background sync replay | ⬜ Todo |

---

## Files Added / Modified

| File | Change |
|---|---|
| `next.config.mjs` | Added `withPWA` wrap, runtime caching, `importScripts` |
| `public/manifest.json` | New — web app manifest |
| `public/icons/icon-192.png` | New — placeholder icon |
| `public/icons/icon-512.png` | New — placeholder icon |
| `public/splashscreens/splash-*.png` | New — 5 iOS splash placeholders |
| `public/sw-custom.js` | New — push + background sync SW handler |
| `app/layout.tsx` | Added manifest link, Apple PWA meta tags |
| `app/api/push/subscribe/route.ts` | New |
| `app/api/push/unsubscribe/route.ts` | New |
| `app/api/push/send/route.ts` | New |
| `app/api/sync/flush/route.ts` | New |
| `lib/push/client.ts` | New — browser push helpers |
| `lib/push/background-sync.ts` | New — offline confirm with SW fallback |
| `components/pwa/push-opt-in.tsx` | New |
| `components/pwa/install-prompt.tsx` | New |
| `components/app/admin-sidebar.tsx` | Added `<InstallPrompt>` + `<PushOptIn>` |
| `components/app/sitter-shell.tsx` | Added `<PushOptIn>` |
| `supabase/migrations/20260418000000_phase7_pwa.sql` | New |
| `docs/cattery-management-spec.md` | §16.3 phase table updated (PWA → Phase 7) |
| `docs/phases/phase-05-06-handoff.md` | Updated Next Phase Preview |

---

## Notes for Next Agent

> Read this before starting **Phase 8 — Health Tickets** (ticket open/update/resolve flow; activity thread; ticket medications; vet visit linking; Admin + Sitter views) per §16.3.

### Must-Read Files Before Starting
- `supabase/migrations/20260417000000_phase5_6_preventive_medication.sql` — the `regenerate_medication_tasks()` trigger is the template for any "plan → daily tasks" surface.
- `components/health/due-chip.tsx` — due-status chip pattern reusable for ticket severity/status.
- `components/medications/medications-card.tsx` — "today's tasks + active schedules + admin CTA" layout close to what a health ticket card will need.
- `components/cats/my-cats-client.tsx` — the per-cat expandable task rail.
- `public/sw-custom.js` — if Phase 8 introduces its own notification type (e.g. ticket opened), extend the push handler here with a different `tag`.

### Push notification usage pattern for future phases
To send a notification from a Phase 8+ API route:
```ts
// Inside a Next.js API route (server-side only)
import webpush from 'web-push';
// webpush is already configured in /api/push/send — reuse that endpoint
// or call webpush.sendNotification() directly after fetching subscriptions
```

Or call `POST /api/push/send` from another API route or Edge Function.

---

## Next Phase Preview

**Phase 8 — Health Tickets** — ticket open/update/resolve flow; activity thread; ticket medications; vet visit linking; Admin + Sitter views.

Expected work:
- **DB**: `health_tickets` (severity: low/medium/high/critical, status: open/in-progress/resolved, cat_id, created_by, assigned_to), `health_ticket_events` (append-only thread: status change / comment / linked medication / vet visit)
- **API**: CRUD on tickets; list by cat; list all open (admin); add event
- **UI**: `<HealthTicketsCard>` on cat detail (admin + sitter); `<HealthTicketModal>` to open/update; event thread view; severity badge; resolution flow
- **Sitter integration**: Replace the "Report Issue" `comingSoon` toast in `components/cats/my-cats-client.tsx` with the real ticket-open modal
- **Admin**: Optional tickets list page `/health-tickets` with severity filter + unresolved count badge in sidebar

Smoke-test before starting Phase 8: build (`npm run build`), visit `/cats`, open a cat, confirm PWA manifest loads (check DevTools → Application → Manifest), check "Add to Home Screen" appears in Chrome.
