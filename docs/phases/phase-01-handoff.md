# Phase 1 — Foundation — Handoff

**Completed by:** Claude (Opus 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §1–§3.1, §15 (cross-cutting UI/UX)

---

## What Was Built

### Features & Screens
- [x] **Auth** — email/password sign-in via Supabase Auth; session-based; persistent; middleware-gated routes; POST `/auth/signout`.
- [x] **App shell** — `(app)` route group with top nav, main nav, user menu (theme + language + logout). Dashboard stub at `/` with active-cats count widget.
- [x] **Admin user management** (`/users`) — list, create (email/password/role), edit (name/role), deactivate/reactivate (auto-revokes sessions), reset password. Admin-only via server checks + UI gating.
- [x] **Cat CRUD** — list (`/cats`) with search, create (`/cats/new`), detail (`/cats/[id]`) with overview card, photo gallery (multi-upload, set-profile, delete), and pedigree certificate upload. Edit via responsive modal.
- [x] **Cross-cutting UI primitives** — `<ResponsiveModal>` (Dialog desktop / Drawer mobile), Button, Input, Label, Card, Dialog, Drawer, Select, Dropdown, Avatar, Badge, Textarea.
- [x] **i18n** — `next-intl` with `en` + `ms` message catalogues; locale detection: cookie → `profiles.preferred_language` → default `en`. Language switcher in user menu writes cookie and persists to profile.
- [x] **Theme** — `next-themes` with `attribute="class"`, system default, manual Light/Dark/System override persisted to `profiles.theme_preference`.
- [x] **Viewport rules** — `maximum-scale=1, user-scalable=no`, `touch-action: pan-y`, `overflow-x: hidden`, 16px input font-size (iOS zoom prevention).
- [x] **React Query v5** — global `QueryClient`, used by `/users` and `/cats` pages with `useQuery`/`useMutation`, invalidation on mutate, retry: 1, refetchOnWindowFocus.
- [x] **Zod** — schemas in `lib/schemas/{auth,users,cats}.ts` used on both client (via `zodResolver`) and API routes.

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users with email (admin only) |
| POST | `/api/users` | Create user via service role (admin only) |
| PATCH | `/api/users/[id]` | Update profile; deactivation revokes sessions |
| POST | `/api/users/[id]/password` | Admin set-password |
| GET | `/api/cats` | List cats with optional `q` and `status` filters |
| POST | `/api/cats` | Create cat (admin only) |
| GET | `/api/cats/[id]` | Cat + photos |
| PATCH | `/api/cats/[id]` | Update cat (admin only) |
| POST | `/api/cats/[id]/photos` | Register uploaded gallery photo |
| DELETE | `/api/cats/[id]/photos?photo_id=` | Remove photo + storage object; promote next as profile |
| PUT | `/api/cats/[id]/pedigree` | Set/clear pedigree URL |
| POST | `/auth/signout` | Sign out + redirect to `/login` |

### Deviations from Spec
- **shadcn CLI** — not used; primitives hand-written inline (functionally equivalent). Rationale: avoid interactive CLI and registry network dependency during scaffold.
- **Bottom tab bar (Cat Sitter mobile nav)** — deferred to Phase 3 (Assignees), where the Cat Sitter "My Cats" landing page lives; Phase 1 ships a shared top nav for both roles.
- **i18n `messages` files** — only the strings needed in Phase 1 are translated; later phases must extend `messages/en.json` + `messages/ms.json`.
- **Breed dropdown** — stored as free text in `cats.breed`. The admin-configurable breed list is deferred to Phase 15 (Polish / system settings UI).

### New Environment Variables
| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for admin user ops | Yes (server only) |

---

## Database Changes

### New Tables
| Table | Migration file | Notes |
|---|---|---|
| `profiles` | `20260413000000_phase1_foundation.sql` | FK to `auth.users`; role enum; preferred_language + theme_preference |
| `cats` | same | All Phase 1 fields + `assignee_id`, `life_stage_multiplier`, `pedigree_photo_url` (populated later) |
| `cat_photos` | same | Gallery with `is_profile`, `sort_order`, FK cascade on cat delete |

### Enums
`user_role`, `theme_pref`, `lang_code`, `cat_gender`, `cat_status`.

### RLS Policies
- `profiles`: select own row or admin-all; self-update limited (own row); admin FOR ALL.
- `cats`: select for active users; INSERT/UPDATE/DELETE admin-only.
- `cat_photos`: select for active users; writes admin-only.

### Helper Functions
- `public.is_admin()` — `SECURITY DEFINER`, used in RLS.
- `public.is_active_user()` — `SECURITY DEFINER`.
- `public.handle_new_user()` — AFTER INSERT trigger on `auth.users`: auto-inserts a `profiles` row with role/full_name derived from user metadata (admin-created users always overwritten by API).
- `public.set_updated_at()` — trigger helper.

### Storage Buckets
`cat-photos`, `pedigree-photos`, `avatars` (public read; admin-only write for cat/pedigree, self-write for avatars). Bucket policies defined in the migration.

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- `/login` page's "is_active = false" check happens client-side after successful sign-in. Middleware only checks auth presence, not `is_active`. For defence-in-depth this should also be enforced in middleware (Phase 15 polish).
- `user-menu.tsx` language switcher persists to profile on every click without debouncing; fine at current scale.
- Dashboard is placeholder — proper widgets land incrementally in later phases.

### Known Bugs
_None observed._ UI not E2E tested yet (no dev server smoke test performed).

### Cut from This Phase
- **Sidebar navigation for Admin** (spec §15): kept minimal top nav; full sidebar vs bottom-tab split lands in Phase 3.
- **Per-cat avatar upload for Cat Sitters**: not applicable this phase (role: read-only for cats).

---

## Test Coverage

### What Is Tested
- **Typecheck** — `tsc --noEmit` passes cleanly.
- **Build** — `next build` succeeds; all 11 routes compile and server/static separation validated.

### What Is NOT Tested (Should Be)
- Unit: Zod schema edge cases
- Integration: RLS policies against real Supabase (requires live DB smoke test; see below)
- E2E: none yet — add Playwright in Phase 15

---

## Notes for Next Agent

> Read this carefully before starting **Phase 2 — Rooms**.

### Must-Read Files Before Starting
- `supabase/migrations/20260413000000_phase1_foundation.sql` — enum + RLS conventions you must mirror.
- `lib/supabase/server.ts` + `lib/supabase/client.ts` — the two client factories (SSR cookies already wired).
- `lib/supabase/types.ts` + `lib/types.ts` — **`lib/types.ts` is the Supabase-generated file**; regenerate it after every migration with `supabase gen types typescript > lib/types.ts`. Do NOT hand-edit it.
- `components/ui/responsive-modal.tsx` — use this everywhere for forms/dialogs.
- `lib/auth/current-user.ts` — `getCurrentUser()` / `requireAdmin()` server helpers for API routes.

### Non-Obvious Decisions
- **`@supabase/ssr` version**: locked to `^0.10.2`. Versions <0.7 import `GenericSchema` from a path that no longer exists in `@supabase/supabase-js@2.103+`, which silently breaks the `Database` generic (Schema becomes `never`, all `.from()` calls untyped). If you ever downgrade ssr, you will hit the "Argument of type '{…}' is not assignable to parameter of type 'never'" error wall.
- **Types file location**: there are _two_ places:
  - `lib/types.ts` — generated, authoritative DB types (committed).
  - `lib/supabase/types.ts` — re-exports + app-level aliases (`Profile`, `Cat`, `CatPhoto`, enum aliases). Import from `@/lib/supabase/types` everywhere in app code.
- **Service-role client** (`createServiceRoleClient`) — _only_ used in `/api/users/*` routes because admin user-creation needs `auth.admin.createUser`. Do not use it elsewhere; prefer the anon SSR client so RLS actually runs.
- **Trigger `on_auth_user_created`** — auto-creates a bare profile when `auth.admin.createUser` inserts. The API route then updates name/role. This is the reason we don't need to do two-step insert.
- **Cat status enum uses lower-case** (`active|retired|deceased|sold`). The UI translation layer does capitalisation.
- **Image compression** — `browser-image-compression` is used in `lib/storage/upload.ts`. Max 1.2MB, 2000px, 0.85 quality. Keep consistent across phases.
- **Language detection on SSR** — `i18n/request.ts` reads cookie first, then profile. Setting the cookie alone is enough for unauthenticated users.

### Gotchas
- **RLS recursion**: `is_admin()` / `is_active_user()` are `SECURITY DEFINER` and bypass RLS when running; they must stay that way or RLS on `profiles` will self-reference.
- **Middleware matcher**: the current matcher excludes `_next/*`, image files, and `api/public`. Any new public API must live under `/api/public/*` or be added to the matcher exclusion.
- **Form default values**: `react-hook-form`'s `defaultValues` is evaluated ONCE. Use `values={...}` when the form needs to re-populate from server data after the parent re-renders (see `EditUserSheet` in `components/users/users-client.tsx`).
- **Cookie encoding**: `@supabase/ssr` 0.10 uses base64url by default. If you roll cookies manually, match the encoding.
- When an admin deactivates a user, we call `auth.admin.signOut(userId)` — the revoke is best-effort; the user may still have a cached JWT for up to 1 hour until their refresh token is next exchanged. Middleware re-validates on every request though.

### Context on Shared Components / Utils
- **`<ResponsiveModal title={...} onOpenChange={...}>`** — the only overlay primitive you should use. Desktop → `<Dialog>`, mobile → vaul `<Drawer>` with sticky header + independently scrollable body. Nested modals are NOT supported (spec §2.3).
- **`formatDate(iso, locale)`** in `lib/utils.ts` — renders dd/MM for `ms`, MM/DD short for `en`.
- **`uploadImage(bucket, file, keyPrefix)`** — returns `{ url, path }`. Compresses first. Always pass the entity id as `keyPrefix` so storage paths are scoped (`cat-photos/<cat-id>/…`).

---

## Spec Updates This Phase

_None._ Nothing in `cattery-management-spec.md` was modified during Phase 1.

---

## Next Phase Preview

**Phase 2 — Rooms**

> _From §16.3:_ Room directory CRUD, cat room assignment, movement log, room overview UI.

Relevant spec sections to re-read:
- §7 — Room Management System (all subsections: 7.1–7.5)
- §3.1 — confirms `current_room_id` lives on `cats`

Expected DB work:
- New tables: `rooms`, `room_movements`
- Alter `cats` to add `current_room_id uuid references rooms(id)` (nullable)
- Trigger: on `cats.current_room_id` change, insert into `room_movements`
- RLS: `rooms` — any active user reads, admin writes; `room_movements` — any active user reads, INSERTs only via trigger (no user writes)

Key files the next agent will likely touch:
- `supabase/migrations/20260414_phase2_rooms.sql` (new)
- `lib/types.ts` (regenerate)
- `lib/supabase/types.ts` (add aliases `Room`, `RoomMovement`)
- `lib/schemas/rooms.ts` (new)
- `app/(app)/rooms/page.tsx`, `/rooms/[id]/page.tsx` (new)
- `components/rooms/*` (new)
- `components/cats/cat-detail.tsx` — add "Room" overview row + "Move Room" action + "Room History" section
- `components/cats/cat-form.tsx` — add room selector (edit-only; admin-only)
- `app/api/rooms/*` — full CRUD
- `messages/en.json`, `messages/ms.json` — add `rooms.*` keys

Smoke-test before starting: run the Phase 1 migration against your Supabase project, create an admin user, sign in at `/login`, create one cat, upload a photo. If that round-trip works, the foundation is healthy.
