# Phase 3 — Assignees — Handoff

**Completed by:** Claude (Opus 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §8 (Cat Assignee System), §15 (UI/UX Notes)

---

## What Was Built

### Features & Screens
- [x] **Cat detail: Primary Assignee row** — new row in the Overview card shows assignee name (linked-in future, text for now) or "Unassigned". Admins get a pencil affordance that opens `<AssignCatModal>`.
- [x] **`<AssignCatModal>`** — uses the new `<AssigneeSelect>` searchable dropdown; submits to `POST /api/cats/[id]/assign`; invalidates `cats`, `cat`, `assignees`, `users` query keys; `router.refresh()` after save.
- [x] **`<AssigneeSelect>`** — searchable (name filter) dropdown of active Cat Sitters, with optional "Unassigned" sentinel and an `excludeId` prop (used by reassign-on-deactivate to hide the sitter being disabled). Shows each sitter's assigned-cats count inline.
- [x] **Cat list cards** (admin + sitter All Cats) — now show the primary assignee name under breed/DOB/room, as spec §8.2 mandates for the "All Cats" view.
- [x] **Users list** — admin now sees a small `🐱 N` badge on every active Cat Sitter row indicating their active-cat assignment count.
- [x] **Guarded deactivation flow** — clicking "Deactivate" on a sitter with assigned cats opens `<ReassignOnDeactivateModal>` instead of firing the mutation directly. The modal forces the admin to pick a new assignee (or explicitly leave them unassigned) before the deactivation PATCH is sent, so cats never end up orphaned by surprise.
- [x] **`/my-cats` (Cat Sitter landing)** — replaced the Phase 2 stub. Now calls `GET /api/me/cats` and renders a per-cat card with avatar, current room, and four quick-action buttons (Log Weight / Log Meal / Log Med / Report Issue). The buttons are functional placeholders — they show a "Coming soon" toast. The real logging flows land in Phases 4–6.
- [x] **Translations** — new `assignees.*` and `sitterActions.*` groups in `messages/en.json` + `messages/id.json`.

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET | `/api/me/cats` | Current user's assigned, active cats, with embedded `current_room` and `assignee`. Cat Sitters only. |
| POST | `/api/cats/[id]/assign` | Admin-only. `{ assignee_id: uuid | null }`. Validates the target is an active cat_sitter before updating `cats.assignee_id`. |

### API Routes Extended
| Method | Path | Change |
|---|---|---|
| GET | `/api/users` | Response rows now include `assigned_cats_count: number` (0 for admins). |
| PATCH | `/api/users/[id]` | Body accepts optional `reassign_to: string | null`. On deactivation, the endpoint first counts assigned active cats; if > 0 and `reassign_to` is `undefined`, returns **409** with `{ code: 'ASSIGNED_CATS_PRESENT', assigned_count }`. If `reassign_to` is present (including `null`), it bulk-updates `cats.assignee_id` before flipping `profiles.is_active` and revoking sessions. |
| GET | `/api/cats` | Embed changed to `select('*, current_room:rooms(id, name), assignee:profiles!cats_assignee_id_fkey(id, full_name)')` — assignee name is now available to every list consumer. |
| GET | `/api/me/cats` | Same embed as above (naturally, since it filters the same table). |

### Deviations from Spec
- **Searchable dropdown uses `/api/users`** — since only admins currently need `<AssigneeSelect>` (change assignee; reassign-before-deactivate), we reuse the existing admin-gated endpoint instead of adding a dedicated public `/api/assignees` route. If a Cat Sitter later needs to pick assignees (unlikely per §8), add a public `/api/assignees` that selects `profiles` where `role='cat_sitter' AND is_active=true`.
- **No `assignee_id` field on the Cat create form** — assignments are managed exclusively via the Primary Assignee row on the cat detail (admin pencil → `<AssignCatModal>`). Rationale: keeps the creation form short; single source of truth for change history (when we add assignee logging later).
- **`/my-cats` quick-action buttons are stubs** — they toast "Coming soon" with the action name. Real implementations wait for the Weight/Eating/Medication/Health-Ticket phases.
- **Reports filterable by assignee (§8.3 last bullet)** — deferred. No reports UI exists yet; filter will be wired in when weight/eating/med modules land.
- **`messages/ms.json`** — still `id.json` (Indonesian) throughout. No change from Phase 1/2.

### New Environment Variables
_None._

---

## Database Changes

### New Migration
`supabase/migrations/20260415000000_phase3_assignees.sql`

### Modified Tables
_None structurally._ The `cats.assignee_id` column has existed since Phase 1; Phase 3 only changes policies and adds a view.

### RLS Policies Added / Modified
- **`profiles`**: added `profiles_select_active_users` — any `is_active_user()` can SELECT any profile row. This is needed so that PostgREST's `assignee:profiles!cats_assignee_id_fkey(id, full_name)` embed works when a Cat Sitter lists cats. The existing `profiles_select_self` and `profiles_admin_all` policies are kept (Postgres combines SELECT policies with OR, so this is purely additive). **Side effect**: Cat Sitters can now read every profile row (including `last_login_at`, `preferred_language`, `theme_preference`). Acceptable for a small cattery team; if we ever have external sitters this needs tightening (see "Gotchas").

### New Views
- **`public.assignee_cat_counts`** — `{ assignee_id, cat_count }` aggregated from `cats` where `status='active'`, grouped by assignee. Exists for completeness (and future reporting), **but the current `/api/users` code intentionally doesn't use it** — it aggregates in JS instead to dodge the "regenerated TS types don't include views" friction. If you add `supabase gen types --view` support later, swap `/api/users` to read the view.

### Edge Functions / pg_cron
_None._

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- **`assignee_cat_counts` view exists but unused by app code** (see above). Leaving it in place because it's cheap, reads clean SQL, and is useful for ad-hoc analytics / future dashboard widgets.
- **`profiles_select_active_users` is wide** — exposes full profile rows (not just `id, full_name, avatar_url`) to every active user. Acceptable for single-tenant, small-team usage; narrow with a view + view-level grants if we ever need stricter isolation.
- **`<AssigneeSelect>` fetches the full `/api/users` list** to derive active sitters. For a small cattery (< 20 users) this is fine. If we ever exceed a few hundred users, add a dedicated `/api/assignees` endpoint that selects just `{id, full_name, assigned_cats_count}` for active cat_sitters.
- **`/my-cats` quick-actions are placebo** — the four buttons (Log Weight / Log Meal / Log Med / Report Issue) just toast "Coming soon". They exist now so the layout gets validated before the real phases wire the modals in.
- **No confirmation dialog on reactivation** — reactivating a previously-deactivated user still fires straight through, because spec doesn't call for a confirmation there. Only deactivation has the reassign prompt.

### Known Bugs
_None observed._ `tsc --noEmit` clean; `next build` succeeds with 26 routes.

### Cut from This Phase
- **Reports filterable by assignee** (§8.3) — no reports module exists yet.
- **Bottom-tab functional content for Tasks / Payroll tabs** — spec §15 lists five sitter tabs; we have three (My Cats / All Cats / Profile). Tasks + Payroll arrive with their owning modules (Phase 4+ for tasks, Phase 9 for payroll).
- **Assignee change history / audit log** — changes to `cats.assignee_id` are not logged anywhere. Consider adding an `assignee_changes` log (mirroring `room_movements`) if audit is needed. Spec doesn't require it today.

---

## Test Coverage

### What Is Tested
- **Typecheck** — `tsc --noEmit` clean.
- **Build** — `next build` passes; 26 routes compile including `/api/me/cats`, `/api/cats/[id]/assign`.

### What Is NOT Tested (Should Be)
- Integration: the 409 conflict path on `PATCH /api/users/[id]` — end-to-end, with a sitter who has 3 assigned cats, verify the UI opens the reassign modal instead of flipping is_active.
- Integration: RLS relaxation — sign in as a Cat Sitter and confirm they can read another sitter's profile name via the cat list embed.
- RLS: verify the bulk `UPDATE cats SET assignee_id=…` in the deactivation flow only touches rows belonging to the target sitter. (It does — scoped with `.eq('assignee_id', params.id).eq('status','active')`).
- E2E: none.

---

## Notes for Next Agent

> Read this carefully before starting **Phase 4 — Weight tracking** (or whichever module comes next).

### Must-Read Files Before Starting
- `supabase/migrations/20260415000000_phase3_assignees.sql` — the wider profiles RLS policy lives here; anything that needs to read cat_sitter names now just works.
- `components/assignees/assignee-select.tsx` — the searchable-dropdown pattern. Re-use it (or generalise it) if other modules need "pick a user" UIs.
- `components/assignees/reassign-on-deactivate-modal.tsx` — the pre-action-guard modal pattern. Same shape works for "delete room that still has cats", "archive cat that still has open health tickets", etc.
- `app/api/users/[id]/route.ts` — the 409-then-confirm flow on destructive actions. If you add more destructive endpoints, follow this pattern (precheck, return 409 + `code`, client catches the code and opens a modal).
- `components/cats/my-cats-client.tsx` — the landing layout Cat Sitters see. The four quick-action buttons are where Phase 4+ will plug in real modals.

### Non-Obvious Decisions
- **Assignee changes happen through a dedicated endpoint, not PATCH /api/cats/[id]** — even though `catSchema` already has `assignee_id` in it. Rationale: (1) the assign endpoint validates the target is an active cat_sitter, which a generic PATCH can't do cleanly; (2) keeps future audit-logging isolated to one path; (3) mirrors the `move_cat` RPC pattern for "admin does X to a cat" where X has its own semantics.
- **`assignee_cat_counts` is a view, not a materialized view** — the `cats` table is tiny and the count query is cheap; materialization would add refresh cost for no benefit.
- **`/api/users` aggregates assigned_cats_count in JS** rather than joining the view — the Supabase-generated TS types don't know about views (regen strips them), and we don't want to re-cast every time. JS aggregation over a small profile list is a one-off ~5ms cost.
- **`<AssigneeSelect>` is NOT built on a Radix Popover** — we don't have a Popover primitive yet, so it uses a plain `open` state + a full-screen click-catcher div. If a Popover lands in a later phase, refactor.
- **`reassign_to: null` means "unassign all"** — not "don't do anything". The modal's default state is `null`, which reads as "reassign to Unassigned". The admin has to explicitly pick a sitter to hand them over. Dropping `reassign_to` entirely from the body is what triggers the 409 precheck.

### Gotchas
- **Wider profiles RLS**: Cat Sitters can now SELECT every profile row, including inactive admins. If you add sensitive fields to `profiles` later (personal email, phone, home address), either tighten the policy or move those fields to a separate admin-only table.
- **`/api/users` is admin-gated but called from sitter-facing contexts indirectly** — `<AssigneeSelect>` only renders in admin-only modals today. If you ever render it on a sitter page, it'll 403 silently and the dropdown will show "Nothing here yet." (the react-query error is swallowed). Route around this via a narrower `/api/assignees` endpoint.
- **Deactivation flow is two PATCH shapes** — `{ is_active: false }` → 409 if cats assigned; `{ is_active: false, reassign_to: uuid | null }` → succeeds atomically. Don't collapse them; the precheck is the safety net against dropping the `reassign_to` key by accident.
- **`cats.assignee_id` set via PATCH /api/cats/[id]` still works** (catSchema includes it), but it bypasses the active-cat-sitter validation. The UI never uses that path, but if you expose a cat-form assignee field in the future, add the same validation to the PATCH route too.
- **`<AssigneeSelect>` react-query key is hard-coded to `['assignees']`** — invalidate it whenever anything changes the set of active sitters (user deactivation, role change). `<AssignCatModal>` and `<ReassignOnDeactivateModal>` already do.

### Context on Shared Components / Utils
- **`<AssigneeSelect value onChange excludeId? allowUnassigned?>`** — the single source of "pick a sitter" UI. `excludeId` hides one profile (used to hide the sitter being deactivated); `allowUnassigned` (default true) shows a leading "Unassigned" option that emits `null`.
- **`<AssignCatModal catId currentAssigneeId>`** — admin-only cat-assignee change; invalidates `['cats']`, `['cat', catId]`, `['assignees']`, `['users']`, then `router.refresh()`.
- **`<ReassignOnDeactivateModal userId userName assignedCount>`** — admin-only; opened when `handleToggleActive` sees `is_active && assigned_cats_count > 0`. Submits `PATCH /api/users/[id]` with `{ is_active: false, reassign_to }`. Don't open this modal in any other context; it assumes the target is currently active + has cats.
- **`<MyCatsClient firstName>`** — server passes the first token of the user's full_name so we can greet "Hi Siti" without re-hitting `profiles` client-side.

---

## Spec Updates This Phase

_None._ `cattery-management-spec.md` unchanged.

---

## Next Phase Preview

**Phase 4 — Weight tracking** (per §3.3 / §16.3 of the spec — confirm the exact phase before starting).

Relevant spec sections to re-read:
- §3.3 — Weight entry / graph
- §8.2 — the Log Weight quick-action from `<MyCatsClient>` is where the new UI hooks in
- §15 — remember: mobile-first; input fields should use `type="number" inputmode="decimal"` and avoid iOS zoom

Expected work (ballpark):
- **DB**: `weight_logs` table (`cat_id`, `weight_kg numeric(5,2)`, `measured_at`, `logged_by`, `notes`). RLS: any active user reads; any active user writes (sitters can log for any cat, not just assigned ones — §8.1).
- **API**: `POST /api/cats/[id]/weight`, `GET /api/cats/[id]/weight` (history + pagination).
- **UI**:
  - `<LogWeightModal>` — wire into both `<MyCatsClient>` quick-actions and a "Log weight" button on cat detail.
  - Cat detail: new "Weight" tab or card with history + a sparkline / line chart (pick a tiny charting lib — `recharts` is heavy, consider `@visx/sparkline` or hand-roll SVG).
- **Nav**: no changes; lives inside cat detail + `/my-cats`.

Key files the next agent will likely touch:
- `supabase/migrations/20260416000000_phase4_weight.sql`
- `lib/schemas/weight.ts`
- `app/api/cats/[id]/weight/route.ts`
- `components/weight/log-weight-modal.tsx`, `components/weight/weight-chart.tsx`
- `components/cats/my-cats-client.tsx` — replace the `comingSoon(...)` toast for "Log weight" with opening the modal.

Smoke-test before starting Phase 4: apply the Phase 3 migration, sign in as admin, assign a cat to a sitter, sign out, sign in as that sitter → `/my-cats` should show the cat. Sign back in as admin, try deactivating that sitter — the reassign modal should appear with the correct count.
