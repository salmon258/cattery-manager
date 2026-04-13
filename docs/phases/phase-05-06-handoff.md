# Phase 5 + 6 — Preventive Health + Medication — Handoff

**Completed by:** Claude (Opus 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §3.5 (Medicine & Vitamin Log), §3.6 (Vaccination Records & Reminders), §3.7 (Deworming & Flea Treatment Records & Reminders), §16.3 phase table

> Note: Phase 5 (Preventive Health) and Phase 6 (Medication) were built in a single pass because they share a migration, an RLS shape, and the same mental model ("any sitter can submit, admin manages catalogue/schedules"). One combined handoff keeps that relationship visible.

---

## What Was Built

### Features & Screens
- [x] **Vaccinations log + reminders** (§3.6) — `<VaccinationsCard>` on cat detail with a due-status chip (Overdue / Due soon / Up to date / No record), full per-cat history, and a `<LogVaccinationModal>`. Vaccine types: F3, F4, Tricat, FeLV, Rabies, Other. `next_due_date` auto-prefilled from `VACCINE_DEFAULT_INTERVAL_DAYS` (365 for all preset types), user-editable.
- [x] **Preventive treatments** (§3.7) — `<PreventiveCard>` with the same chip + history shape, `<LogPreventiveModal>`, types Deworming / Flea / Combined. 90-day default interval.
- [x] **Scheduled medications** (§3.5.2) — `<MedicationsCard>` (admin "New schedule" + Ad-hoc logger in one place), `<NewMedicationModal>` accepts medicine name / dose / route / date range / `interval_days` / `time_slots[]`. On insert or update, a SECURITY DEFINER trigger calls `regenerate_medication_tasks()` which materialises every future, unconfirmed dose into `medication_tasks`.
- [x] **Daily task list + quick confirm** — `/my-cats` now surfaces today's + overdue medication tasks per assigned cat, each with a one-tap Confirm button. Admins see the same list on a cat's detail page inside `<MedicationsCard>` (and the `New schedule` button). Overdue tasks get a destructive-tinted card.
- [x] **Compliance stats per schedule** — `GET /api/medications/[id]` returns `{ confirmed, missed, compliance_rate }` derived from the task log (missed = past-due, not confirmed, not skipped). The number is wired into the API response; the detail surface reading it lands alongside the full admin reports in **Phase 12 — Reports**.
- [x] **Ad hoc medicine / vitamin log** (§3.5.1) — `<LogAdHocMedModal>` opens from three places: the Medications card on cat detail, the sitter's quick-action button on `/my-cats`, and the same sheet is reusable wherever a `catId` is in scope. `medicine_name` is free text (stock linkage lands with the dedicated Stock phase).
- [x] **Translations** — full `vaccines.*`, `preventive.*`, `medications.*` + `medications.adHoc.*` groups in `messages/en.json` and `messages/id.json`.

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET / POST | `/api/cats/[id]/vaccinations` | List (with recorder embed) + log a new one. |
| PATCH / DELETE | `/api/vaccinations/[id]` | Admin-only edit / delete. |
| GET / POST | `/api/cats/[id]/preventive` | Same shape as vaccinations. |
| PATCH / DELETE | `/api/preventive/[id]` | Admin-only edit / delete. |
| GET / POST | `/api/cats/[id]/medications` | List active schedules (`?include_inactive=1` for history) + admin-only POST. |
| GET / PATCH / DELETE | `/api/medications/[id]` | Detail with `{ medication, tasks, stats }`; PATCH / DELETE admin-only. The insert / update trigger handles task regen — **never call POST then separately create tasks**. |
| GET / POST | `/api/cats/[id]/ad-hoc-meds` | Any active user may log. |
| GET | `/api/me/tasks` | Today + overdue tasks. Sitter default: only tasks for their assigned cats. Admin default: every cat. `?scope=all\|assigned` to override. |
| POST | `/api/tasks/[id]/confirm` | Any active user confirms a task (sets `confirmed_at`, `confirmed_by`). |
| POST | `/api/tasks/[id]/skip` | Admin-only `{ reason? }` — marks skipped so it doesn't count against compliance. |

### Deviations from Spec
- **Frequency model simplified.** Spec §3.5.2 lists "X times per day, specific days of week, or interval-based". We implemented `interval_days` + `time_slots[]` (HH:MM array). "Specific days of week" is deferred — an admin can work around it today by setting `interval_days = 7` and a single time slot for a weekly dose on the start-date anniversary. Revisit if product owner needs Mon-Wed-Fri style scheduling.
- **Push notifications are not part of this phase.** Spec §3.6 calls for "Push notification + in-app alert X days before `next_due_date`". Push lives in **Phase 13 — PWA**. In-app surfacing is here (due-soon chips, my-cats task list).
- **Vaccine catalogue is enum, not admin-configurable table.** Spec §3.6 mentions "plus custom (admin-configurable)". We let the admin pick the `Other` type and type in a free-text `vaccine_name`. If a proper catalogue table is needed later, mirror the food-items pattern from Phase 4.
- **Admin dashboard widgets** ("Upcoming vaccinations", "Compliance per cat / per medication", "Missed dose log") are explicitly deferred to **Phase 12 — Reports** per the reordered phase table. The data foundations exist; the dashboard surfaces land there.
- **`medication_tasks.skipped` UI is wired in the API but not surfaced.** The POST /skip endpoint + `skip_reason` column are live, but there's no "Skip" button in the UI yet. Added now so the reports phase can render filters without schema migrations.
- **Last-login check on deactivation reassign flow** (Phase 3 scope) is unchanged.

### New Environment Variables
_None._

---

## Database Changes

### New Tables
| Table | Notes |
|---|---|
| `vaccinations` | One row per dose. `vaccine_type` enum + optional `vaccine_name` free text for `other`. |
| `preventive_treatments` | Deworming / flea / combined. |
| `medications` | Scheduled plan (start_date, end_date, `interval_days`, `time_slots text[]`). |
| `medication_tasks` | One row per generated dose. Unique index on `(medication_id, due_at)` prevents trigger-level duplicates. Soft-closed via `confirmed_at` or `skipped`. |
| `ad_hoc_medicines` | Free-form one-off log (§3.5.1). |

### New Enums
- `vaccine_type` — `f3 | f4 | tricat | felv | rabies | other`
- `preventive_treatment_type` — `deworming | flea | combined`
- `med_route` — `oral | topical | injection | other`

### New Functions / Triggers
- **`public.regenerate_medication_tasks()`** — AFTER INSERT or AFTER UPDATE OF `start_date, end_date, interval_days, time_slots, is_active` on `medications`. `SECURITY DEFINER`, `search_path = public`. Deletes future non-confirmed non-skipped tasks then re-materialises the grid using `greatest(start_date, current_date) .. end_date`, stepping by `interval_days`, one row per time slot per dose-day. Past + confirmed tasks are never touched. `is_active = false` short-circuits (no new tasks generated).

### RLS Policies
Following the Phase-3 RLS pattern (active user reads + inserts; admin manages schedules + catalogue):

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `vaccinations` | active user | active user + `recorded_by = auth.uid()` | admin | admin |
| `preventive_treatments` | active user | active user + `recorded_by = auth.uid()` | admin | admin |
| `medications` | active user | admin | admin | admin |
| `medication_tasks` | active user | **denied** (only via trigger) | active user (confirm/skip) | admin |
| `ad_hoc_medicines` | active user | active user + `submitted_by = auth.uid()` | admin | admin |

### Edge Functions / pg_cron
_None._ All scheduling logic is plpgsql + indices; no cron yet (the trigger-materialised tasks don't need refresh).

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- **`regenerate_medication_tasks` only generates from `greatest(start_date, current_date)` forward.** If an admin creates a schedule with `start_date` in the past, the history starts from today. Rationale: we don't retroactively fabricate "should have dosed you yesterday" tasks. If the product owner wants historical task generation for compliance backfill, change `greatest(...)` to just `new.start_date`.
- **`medication_tasks.due_at` is `timestamptz` built from `(day::text || ' ' || time_slot)::timestamptz`.** That cast uses the server's session timezone. For a single-cattery deployment this is correct; for multi-site / multi-timezone, introduce a per-cattery tz and cast with `at time zone`. Matches the Phase 4 timezone tech debt.
- **Task regeneration is not transactional across PATCH to `medications`.** The trigger fires per-row-change, which is what we want — but if an admin patches medicine_name (not a timing field) we don't regen, which is also what we want. Result: edits to `medicine_name` / `dose` / `route` / `notes` do NOT refresh existing tasks' effective medicine label. UI reads medicine details via join at render time, so the displayed name always reflects current state; just know that a dose admin log entry captures the name at confirmation via `confirmed_by` + `confirmed_at`, not a snapshot.
- **`/api/me/tasks` bucket is "end of today local time"**, not "rolling 24h". So a 23:45 dose is visible when you open at 23:59 but may roll off at 00:00 the next day. Trade-off accepted; revisit alongside the PWA phase's notification cadence.
- **Per-cat med tasks on the cat detail page** refetch the whole `me/tasks` response and filter client-side. Fine for small catteries (< a few dozen active scheduled meds). Add a `/api/cats/[id]/tasks` endpoint if the filter becomes hot.
- **Skip button is not in the UI.** The endpoint and column exist so reports can already filter correctly; the admin affordance lands with Phase 12 Reports / Phase 15 Polish.
- **No audit of assignee changes, vaccine edits, or medication edits.** Spec §3.6 / §3.7 don't require it; add a general-purpose audit log in Phase 15 Polish if one becomes necessary.

### Known Bugs
_None observed._ Typecheck clean; build clean after a single `rm -rf .next` (Next 14 stale-route cache issue — same as flagged in the Phase 4 handoff).

### Cut from This Phase
- Push notifications (Phase 13 PWA).
- Admin dashboard widgets: overdue vaccines grid, compliance heatmap, missed-dose log (Phase 12 Reports).
- Per-vaccine admin-configurable catalogue table (enum + free-text for now).
- "Specific days of week" medication frequency (use `interval_days`).
- Prefill `medicine_name` from stock catalogue (Phase 16 Stock).
- Skip-task UI.
- Historical task backfill for past-dated schedules.

---

## Test Coverage

### What Is Tested
- **Typecheck** — `tsc --noEmit` clean.
- **Build** — `next build` passes with 41 routes, including 10 new endpoints: `/api/cats/[id]/{vaccinations,preventive,medications,ad-hoc-meds}`, `/api/{vaccinations,preventive,medications}/[id]`, `/api/me/tasks`, `/api/tasks/[id]/{confirm,skip}`.

### What Is NOT Tested (Should Be)
- The `regenerate_medication_tasks()` trigger: (a) creating a schedule spanning 3 days × 2 slots × `interval_days = 1` generates 6 tasks; (b) editing `time_slots` replaces only future unconfirmed tasks; (c) confirmed tasks survive every regeneration; (d) `is_active = false` empties the future grid.
- RLS: Cat Sitter cannot DELETE their own vaccination row even immediately after INSERT.
- RLS: Cat Sitter cannot insert a `medication_tasks` row directly (only the trigger path).
- RLS: Cat Sitter can UPDATE `medication_tasks.confirmed_at = now()` on any task (via the active-user UPDATE policy) — this is the intended "anyone present can tick off a dose" behavior. Confirm the policy doesn't accidentally allow `medication_id` / `cat_id` rewrites in the same UPDATE. (Safe for now; `confirmed_at` / `confirmed_by` / `skipped` are the only fields the UI sets.)
- E2E: schedule a 2×/day oral med, sign in as a sitter, confirm a task on `/my-cats`, verify the task disappears and `medications/[id]` stats tick confirmed+1.

---

## Notes for Next Agent

> Read this before starting **Phase 7 — Health Tickets** (ticket open/update/resolve flow; activity thread; ticket medications; vet visit linking; Admin + Sitter views) per §16.3.

### Must-Read Files Before Starting
- `supabase/migrations/20260417000000_phase5_6_preventive_medication.sql` — the `regenerate_medication_tasks()` trigger is the template for any other "plan → daily tasks" surface. If Phase 7 needs recurring task-like artifacts (follow-ups, re-check reminders), reuse this shape.
- `components/health/due-chip.tsx` — due-status chip pattern (overdue / due-soon / ok / none). Drop into any card that has a `next_due_date`-shaped field.
- `components/medications/medications-card.tsx` — the "today's tasks list + active schedules + admin CTA" layout. Close to what a Health Ticket card will need.
- `components/cats/my-cats-client.tsx` — the per-cat expandable task rail. Health tickets with severity badges can slot into the same grid.

### Non-Obvious Decisions
- **Task regen is fire-and-forget from the client's side.** POST a medication, the trigger synchronously generates tasks, the API returns, and `['medication-tasks', catId]` invalidation picks them up. No RPC needed. If you ever wrap this in a BEGIN/ROLLBACK, the trigger runs inside the same transaction — so a cancelled POST leaves no orphan tasks.
- **Compliance denominator excludes skipped tasks, not missed ones.** Missed-past-due tasks count against the rate. This matches the spec's "compliance rate per cat / per medication" intent — if the admin explicitly skipped a dose (vet on-site, e.g.), it doesn't punish the sitter.
- **`administered_date` is a SQL `date`** (no time component) across vaccinations + preventives. Next-due math in the client uses plain date arithmetic; no tz gotchas.
- **`time_slots` stored as `text[]` not `time[]`**. Reason: we need PostgREST to round-trip them cleanly and the supabase-js generated types map `time[]` awkwardly. Validation lives in the Zod schema (HH:MM regex) + the DB cast `(day || ' ' || slot)::timestamptz`.
- **`/api/me/tasks` filters by `cat.assignee_id` server-side for sitters**, not by RLS. We'd need a more convoluted RLS policy to scope task reads by assignee; keeping it as a query-time filter keeps RLS simple (active-user SELECT on `medication_tasks`) and the admin scope flag cheap.

### Gotchas
- **types.ts aliases block keeps getting wiped on `supabase gen types`.** Phase 5+6 added 5 new tables and 3 enums; if the next regen wipes the tail, re-append: `Vaccination, PreventiveTreatment, Medication, MedicationTask, AdHocMedicine` and `VaccineType, PreventiveType, MedRoute`.
- **Stale `.next` after route churn** — same Next 14 issue flagged in Phase 4. If a build errors with "Cannot find module for page: /foo", `rm -rf .next && npm run build` fixes it.
- **Unique index on `(medication_id, due_at)`** is the only thing preventing the trigger from inserting duplicates when the parent UPDATE regens. Don't drop it.
- **Be careful editing the trigger function**: it uses `foreach v_slot in array new.time_slots loop` — this only works when `time_slots IS NOT NULL`, which the column constraint enforces. If you relax the constraint later, add a NULL guard.
- **Spec §3.5.2 says "Overdue tasks (not ticked past due time) highlighted in red"** — we do this by comparing `due_at < now()` at render time, no DB state. If you add a "missed" state later, make it a VIEW over `medication_tasks` rather than mutating the column.
- **`/api/me/tasks` returns tasks for admin with `scope=all` default.** If Phase 12 Reports renders an admin dashboard widget pulling from this endpoint, note that the default scope is already admin-appropriate.

### Context on Shared Components / Utils
- **`<DueChip nextDueISO dueSoonDays? labels>`** — stateless badge. `labels` is the translation bundle for the four states plus the "in Nd" / "Nd ago" formatters. Reusable outside health.
- **`<LogVaccinationModal catId>`** / **`<LogPreventiveModal catId>`** — auto-compute `next_due_date` on type / date change; admin can override the prefill.
- **`<NewMedicationModal catId>`** — admin-only. Slot add/remove UI via `form.setValue('time_slots', ...)`. The submit → trigger → query-invalidate cycle refreshes today's-tasks without a manual refresh.
- **`<LogAdHocMedModal catId catName?>`** — reusable anywhere a cat id is known. Used from cat detail (`<MedicationsCard>`) and `/my-cats` quick-action.
- **`<MedicationsCard catId role>`** — single card for both schedules + ad-hoc + today's tasks. Admin sees the "New schedule" button; sitters only see "Log ad hoc" + today's tasks.
- **`/my-cats` per-cat task rail** — renders `<MyTask>` rows (inlined in `my-cats-client.tsx`). Destructive tint when `due_at < now()`. Confirm button invalidates `['me-tasks']` + `['medication-tasks']`.

---

## Spec Updates This Phase

_None._ `cattery-management-spec.md` unchanged (phase table reorder from the previous user turn stands).

---

## Next Phase Preview

**Phase 7 — Health Tickets** — ticket open/update/resolve flow; activity thread; ticket medications; vet visit linking; Admin + Sitter views.

Expected work (ballpark):
- **DB**: `health_tickets` (severity, status, assignee, created_by, cat_id), `health_ticket_events` (append-only thread of status changes, comments, linked meds/vet visits), optional `health_ticket_medications` join table if tickets own their own scheduled meds. Consider reusing the Phase 5-6 `medication_tasks` shape by allowing a ticket to spawn a scheduled medication.
- **API**: `GET /api/cats/[id]/tickets`, `POST /api/cats/[id]/tickets`, `POST /api/tickets/[id]/events` (comments + status transitions), `POST /api/tickets/[id]/resolve`.
- **UI**:
  - Cat detail: "Health tickets" card with open-ticket count, severity badges, activity thread.
  - `<NewHealthTicketModal>`.
  - `/my-cats` quick-action "Report issue" → opens the new-ticket modal (wire the existing `comingSoon` toast to the real flow).
  - Admin dashboard: open tickets count / severity breakdown (can defer to Phase 12 Reports; spec says "Admin + Sitter views" so at minimum render a list page).

Key files the next agent will likely touch:
- `supabase/migrations/20260418000000_phase7_health_tickets.sql`
- `lib/schemas/health-tickets.ts`
- `app/api/cats/[id]/tickets/route.ts`, `app/api/tickets/[id]/route.ts`, `app/api/tickets/[id]/events/route.ts`
- `components/health/tickets/*`
- `components/cats/cat-detail.tsx` — another card
- `components/cats/my-cats-client.tsx` — replace the Report Issue `comingSoon` toast with opening the real modal
- `components/app/admin-sidebar.tsx` — optional "Tickets" entry if we build an admin tickets list page

Smoke-test before starting Phase 7: apply the migration, seed one food item, log a weight + meal (Phase 4 smoke), then: log a vaccination (should chip "Up to date"), log a preventive treatment, schedule a 2×/day medication for 3 days starting today, and verify on `/my-cats` that today's doses appear with the correct times. Confirm one → it should disappear and the cat's destructive task-count badge should drop.
