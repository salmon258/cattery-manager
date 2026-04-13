# Phase 2 — Rooms — Handoff

**Completed by:** Claude (Opus 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §7 (Room Management System)

---

## What Was Built

### Features & Screens
- [x] **Rooms directory** (`/rooms`) — admin-gated grid of active (+ optional inactive) rooms with occupant count, capacity indicator, type badge, over-capacity warning, and "New room" action.
- [x] **Room detail** (`/rooms/[id]`) — name / type / description / occupancy, current occupants list (linked to cat profiles), full movement history for that room, admin Edit / Deactivate actions (soft-delete blocked while occupants present).
- [x] **Room create / edit form** — hand-rolled `<RoomForm>` used inside `<ResponsiveModal>`; reuses existing Select / Input / Textarea primitives. Edit mode shows an "Active" checkbox.
- [x] **Move Room action (admin)** — from cat profile: "Move" button → `<MoveRoomModal>` with destination dropdown (incl. "Unassigned") + optional free-text reason. Calls the `move_cat` RPC which atomically updates `cats.current_room_id` and emits a `room_movements` entry with the reason.
- [x] **Cat overview: current room row** — the Overview card on cat detail now leads with a "Current room" row (linked to the room page, or "Unassigned").
- [x] **Cat detail: "Room history" card** — chronological log with `from → to` (linked), reason, and date; fetched via `/api/cats/[id]/movements`.
- [x] **Cat list cards** — show the current room name under breed/DOB so Cat Sitters can orient quickly (spec §7.4).
- [x] **Main nav** — "Rooms" item added for admins only.
- [x] **Translations** — `rooms.*` keys added to `messages/en.json` and `messages/id.json` (Indonesian; note the repo ships `id.json` not `ms.json` — see Phase 1 spec-vs-reality note in Deviations).

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET | `/api/rooms` | List rooms (`?include_inactive=1`); each row annotated with `occupant_count` (count of active cats currently in that room). |
| POST | `/api/rooms` | Create room (admin). |
| GET | `/api/rooms/[id]` | Room + current occupants (`id, name, profile_photo_url, status, breed, assignee_id`) + recent 200 movements in/out. |
| PATCH | `/api/rooms/[id]` | Update room (admin). Uses `roomUpdateSchema` (partial). |
| DELETE | `/api/rooms/[id]` | Soft-delete (sets `is_active=false`); refuses with 409 if any cat is still currently assigned there. |
| POST | `/api/cats/[id]/move-room` | Admin-only; calls `public.move_cat` RPC with `{ to_room_id, reason }`. Triggered log entry is created atomically in the DB. |
| GET | `/api/cats/[id]/movements` | Chronological room movements for a cat (used by `<CatRoomHistory>`). |

### Deviations from Spec
- **Room assignment on the cat form** — spec §7.2 lists "Admin can assign or move any cat to any room". Phase 2 treats all moves (including the initial assignment of a newly-created cat) as going through the dedicated "Move" UI rather than a field on the cat form. Reasoning: it keeps the movement log authoritative — every change gets a `room_movements` row with a moved_by/reason. The cat-form `assignee_id` behavior is untouched (still deferred to Phase 3).
- **Room views for Cat Sitters** — spec §7.4 says the room overview page is "Admin" and cat sitters see room only via cat cards. We gate `/rooms` in the nav behind admin but leave the underlying RLS open to any active user (selects), so Phase 3's "My Cats" can still read room names cheaply. The room page itself redirects nowhere for sitters — it just doesn't appear in their nav.
- **"Drag cat to transfer" from room detail** (spec §7.4) — not implemented; admins use the per-cat Move button. Drag-and-drop deferred.
- **`messages/ms.json`** — still not present; Phase 1 used `id.json` (Indonesian). Translations land in `id.json`.

### New Environment Variables
_None._

---

## Database Changes

### New Tables
| Table | Migration file | Notes |
|---|---|---|
| `rooms` | `20260414000000_phase2_rooms.sql` | `type room_type`, nullable `capacity`, `is_active` soft-delete, `created_by` FK. |
| `room_movements` | same | Append-only log. FKs to `cats` (cascade on delete), `rooms` (set null on delete), `profiles` (moved_by set null). |

### Modified Tables
| Table | Change | Migration file |
|---|---|---|
| `cats` | Added `current_room_id uuid references rooms(id) on delete set null` + index. | `20260414000000_phase2_rooms.sql` |

### New Enum
`room_type` — `breeding | kitten | quarantine | general | isolation | other`.

### RLS Policies Added
- `rooms`:
  - `rooms_select_active` — SELECT for any `is_active_user()`.
  - `rooms_admin_all` — FOR ALL, admin-only (insert / update / delete).
- `room_movements`:
  - `room_movements_select_active` — SELECT for any `is_active_user()`.
  - **No INSERT / UPDATE / DELETE policies** → direct user writes are denied. The log is populated only by the `log_room_movement` trigger, which is `SECURITY DEFINER` and therefore bypasses RLS.

### Helper Functions / Triggers
- `public.log_room_movement()` — AFTER UPDATE OF `current_room_id` on `cats`. Reads an optional `app.move_reason` session GUC and records `{from_room_id, to_room_id, moved_by=auth.uid(), reason}`. `SECURITY DEFINER`, `search_path=public`.
- `public.move_cat(p_cat_id, p_to_room_id, p_reason)` RPC — `SECURITY DEFINER`; enforces `is_admin()` inside; sets `app.move_reason` via `set_config(..., is_local=true)`; updates `cats.current_room_id`; returns the new `cats` row. Atomic — the GUC is scoped to the transaction so concurrent moves don't leak reasons across each other.

### Edge Functions / pg_cron
_None._

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- **`move_cat` RPC arg types**: `supabase gen types` marks `p_to_room_id` and `p_reason` as non-nullable `string`, but the SQL function explicitly accepts NULL for both ("unassigned" / "no reason"). We cast at the call site in `app/api/cats/[id]/move-room/route.ts:20-21` to relax the generated types — no runtime impact, `supabase-js` serializes them as JSON null. If Supabase improves its codegen later, the cast can be removed.
- **Room list occupant count** uses a separate `select('current_room_id')` over active cats, grouped in JS. Fine for hundreds of cats; past that, swap to `rpc('room_occupant_counts')` returning a single aggregate.
- **Movement history on the room detail page** is capped at 200 entries (`order('moved_at', {ascending:false}).limit(200)`). No pagination UI yet; small catteries will stay well under. Phase 15 polish can add "load more".
- **Dialog confirmation** for room deactivation uses `window.confirm()` rather than a `<ResponsiveModal>` — keeps the UI small. Upgrade when we introduce an AlertDialog primitive.

### Known Bugs
_None observed._ UI was not E2E tested (no dev server interaction); build + `tsc --noEmit` both pass.

### Cut from This Phase
- Drag-and-drop transfer from room detail (spec §7.4).
- Bulk-move UI (move all kittens from Quarantine → Kitten Ward in one go).
- Inline "Move" from a cat card in the list view (still only available from cat detail).

---

## Test Coverage

### What Is Tested
- **Typecheck** — `tsc --noEmit` passes.
- **Build** — `next build` succeeds; 22 routes compile. New routes: `/rooms`, `/rooms/[id]`, `/api/rooms`, `/api/rooms/[id]`, `/api/cats/[id]/move-room`, `/api/cats/[id]/movements`.

### What Is NOT Tested (Should Be)
- Trigger behavior against a live Supabase: (a) moves made via the RPC get the reason logged; (b) moves made via direct PATCH on `cats` (if any future path allows) still log with null reason; (c) identical-room "moves" (no-op) do NOT produce a log row.
- RLS: verify `room_movements` cannot be INSERTed/UPDATEd/DELETEd directly by an `authenticated` client, only via the trigger.
- `move_cat` admin-only enforcement — RLS would already deny, but the `raise exception 'forbidden: admin only'` path inside the function is the clear signal.
- E2E: none.

---

## Notes for Next Agent

> Read this carefully before starting **Phase 3 — Assignees**.

### Must-Read Files Before Starting
- `supabase/migrations/20260414000000_phase2_rooms.sql` — the trigger + RPC pattern here is the template for any future "atomic admin-only action with reason logging" (e.g. status changes, transfers of ownership).
- `lib/supabase/types.ts` — regenerated after Phase 2. **The app-level aliases (`Cat`, `Room`, `RoomMovement`, `RoomType`, etc.) live at the bottom of the file below a banner comment.** `supabase gen types typescript` overwrites the whole file, so the next time you regen, you must re-append the aliases block. See `Gotchas` below.
- `components/cats/move-room-modal.tsx` — pattern for admin-only cat mutations that also invalidate multiple query keys (`cats`, `cat`, `rooms`, `movements`).
- `app/api/cats/[id]/move-room/route.ts` — only place in the codebase using `supabase.rpc(...)`. Follow this pattern for any future RPC-backed mutation.

### Non-Obvious Decisions
- **Trigger + RPC + GUC sandwich** (`log_room_movement` ← cats UPDATE ← `move_cat` ← API route). Reason: `auth.uid()` is available inside the trigger (via the caller's session when the RPC is `SECURITY DEFINER` — Postgres still tracks the JWT uid), but the *reason* is not part of an UPDATE row. The simplest way to get a free-form reason into the trigger is a session-local GUC set by `move_cat` with `set_config(..., true)`. `true` = LOCAL, transaction-scoped, auto-cleared at commit.
- **Why the trigger fires on UPDATE OF `current_room_id` (not on INSERT or on every UPDATE)** — Phase 1's cat-create flow doesn't assign a room; initial room assignment happens via the Move action and that's an UPDATE from `null → uuid`. The trigger's `is not distinct from` guard skips no-op updates.
- **Why `/api/rooms` annotates occupant counts in the list response instead of a separate `/api/rooms/counts` route** — rooms list is low-cardinality and almost always rendered together with counts; one round-trip beats two. The count scan only reads `current_room_id` from active cats.
- **Why `DELETE /api/rooms/[id]` soft-deletes rather than hard-deletes** — movement history needs to reference historical rooms. Hard-deleting would nullify the FKs on `room_movements.from_room_id / to_room_id` (they're `ON DELETE SET NULL`), which is lossy. Soft-delete keeps the history coherent.
- **Cat list → `select('*, current_room:rooms(id, name)')`** uses PostgREST embedded resource. Supabase resolves it via the `cats_current_room_id_fkey` FK we defined. There is exactly one FK between `cats` and `rooms`, so no disambiguation hint is needed.

### Gotchas
- **Regenerating types wipes the aliases block.** When you next run `supabase gen types typescript > lib/supabase/types.ts`, re-append:
  ```ts
  export type Profile = Database['public']['Tables']['profiles']['Row']
  export type Cat = Database['public']['Tables']['cats']['Row']
  export type CatPhoto = Database['public']['Tables']['cat_photos']['Row']
  export type Room = Database['public']['Tables']['rooms']['Row']
  export type RoomMovement = Database['public']['Tables']['room_movements']['Row']
  export type UserRole = Database['public']['Enums']['user_role']
  export type ThemePref = Database['public']['Enums']['theme_pref']
  export type LangCode = Database['public']['Enums']['lang_code']
  export type CatGender = Database['public']['Enums']['cat_gender']
  export type CatStatus = Database['public']['Enums']['cat_status']
  export type RoomType = Database['public']['Enums']['room_type']
  ```
  (See the "Intentional Tech Debt" item above about `move_cat` arg types — you'll need to re-apply the cast fix too if regen reverts it.)
- **Session GUC leakage**: `set_config('app.move_reason', …, is_local=true)` is transaction-local. If you ever add another RPC that also uses a GUC, pick a distinct key — the parent transaction sees whatever the current function last set.
- **`room_movements` RLS is "read-only for users"**: if any future code path tries to INSERT directly from an API route (not via the trigger), it will silently produce zero rows under RLS. Always funnel through the trigger — i.e., update `cats.current_room_id` and let the log follow.
- **Capacity is a soft warning, not an enforced limit**: the DB has no check constraint. If a future phase needs hard capacity, add a BEFORE UPDATE trigger.
- **`move_cat` throws `forbidden: admin only` (42501) and `cat not found` (P0002)**: the API route surfaces these through `error.message`. If you add richer error handling downstream, map these SQLSTATEs specifically.

### Context on Shared Components / Utils
- **`<MoveRoomModal catId currentRoomId />`** — the only place that calls `/api/cats/[id]/move-room`. Takes `currentRoomId: string | null`; pre-selects it in the destination dropdown; calls RPC, then invalidates `['cats']`, `['cat', catId]`, `['rooms']`, `['movements', catId]` and `router.refresh()`.
- **`<CatRoomHistory catId />`** — lazy-loads a cat's full `room_movements` list and resolves room names from the cached `/api/rooms?include_inactive=1` query. Works for inactive rooms too, since the history may reference now-deactivated ones.
- **`<RoomForm mode room? onDone onCancel />`** — dual-mode form used in both the create modal on `/rooms` and the edit modal on `/rooms/[id]`. Uses `values` (not `defaultValues`) when a room is passed, so it rehydrates correctly across re-renders (same pattern as `EditUserSheet` from Phase 1).
- **`<RoomDetail room initialOccupants initialMovements role />`** — server-hydrated on the detail page; occupants + movements are NOT re-fetched on client mount. If you add a mutation that would change either list (e.g., moving a cat from this room), call `router.refresh()` after success. `<MoveRoomModal>` already does this.

---

## Spec Updates This Phase

_None._ `cattery-management-spec.md` was not modified.

---

## Next Phase Preview

**Phase 3 — Assignees**

> _From §8:_ Primary-assignee model, admin bulk reassign, "My Cats" dashboard for Cat Sitters.

Relevant spec sections to re-read:
- §8 — Cat Assignee System (all subsections: 8.1 – 8.3)
- §3.1 — confirms `assignee_id` already exists on `cats` (Phase 1)
- §15 — mobile bottom-tab nav for Cat Sitters lands here (deferred from Phase 1)

Expected work:
- **DB**: nothing structural — `cats.assignee_id` already exists. Likely add a view `v_cat_sitter_assigned_counts` or a helper function for the "assigned cats count" widget in user management.
- **API**: `GET /api/me/cats` (current user's assigned cats), `POST /api/cats/[id]/assign` (admin; accepts `assignee_id | null`), pre-deactivation bulk-reassign flow.
- **UI**:
  - `/my-cats` — landing page for Cat Sitter role with the per-cat widget stack (weight / eat / med / report action buttons are stubs in Phase 3 — real implementations land in Phase 4–6).
  - Cat detail: "Primary Assignee" row with admin edit.
  - Users list: show assigned-cat count per Cat Sitter row.
  - User deactivation flow: if the target has assigned cats, prompt the admin to reassign them first (blocking modal, pattern similar to the room-occupant guard in `DELETE /api/rooms/[id]`).
  - **Bottom tab bar** for Cat Sitter on mobile (§15 — deferred).
- **Nav**: role-aware landing redirect — Cat Sitter hitting `/` should land on `/my-cats`, admin stays on `/`.

Key files the next agent will likely touch:
- `app/(app)/my-cats/page.tsx` (new)
- `components/cats/assignee-select.tsx` (new) — searchable dropdown of active Cat Sitter profiles
- `app/api/me/cats/route.ts`, `app/api/cats/[id]/assign/route.ts` (new)
- `components/users/users-client.tsx` — add assigned count + bulk reassign gate
- `components/cats/cat-detail.tsx` — add assignee row
- `components/app/main-nav.tsx` + new `components/app/bottom-nav.tsx` — split nav by role / viewport
- `messages/en.json`, `messages/id.json` — extend with `assignees.*`

Smoke-test before starting Phase 3: apply the Phase 2 migration, create two rooms, create a cat, move it between rooms via the UI (both with and without a reason), refresh — verify the Room History card on the cat page and the Movement history on the room page both reflect the moves with the correct from/to/reason.
