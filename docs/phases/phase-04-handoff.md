# Phase 4 — Daily Care Logs — Handoff

**Completed by:** Claude (Opus 4.6)
**Completed at:** 2026-04-13
**Branch / commit:** `main` @ (uncommitted)
**Spec version ref:** `cattery-management-spec.md` §3.3 (Weight), §3.4 (Eating + Food Catalogue + RER / MER), §16.3 phase table

---

## What Was Built

### Features & Screens
- [x] **Weight logging** — `<LogWeightModal>` + `<WeightCard>` on cat detail. Card shows latest reading, Δ from previous (green / amber / red when ≥10% change), full-height SVG sparkline, and a rolling log list. Lives inside the existing Overview grid.
- [x] **Admin food catalogue** — new `/food-items` page (admin-only) with full CRUD via `<FoodItemsClient>` + reusable create/edit sheet. Soft-delete (sets `is_active=false`) because `eating_log_items` references food items `ON DELETE RESTRICT`. Sidebar now has a "Food catalogue" entry under Manage.
- [x] **Eating logging** — `<LogEatingModal>` supports the multi-row food-item flow from spec §3.4.3: feeding method (self / assisted / force_fed), repeatable food rows (pick from catalogue + grams given + how-much-eaten), live total-kcal estimate, optional notes.
- [x] **Per-cat kcal progress** — `<EatingCard>` on cat detail renders today's consumed kcal vs recommended target, a status badge (green / amber / red per spec §3.4.4), a last-7-days bar chart, and a recent-meals feed. Plus a compact hero-strip `<CatKcalBanner>` at the top of the detail page so the daily target is unmissable.
- [x] **Sitter quick-actions wired** — `/my-cats` per-cat cards now open `<LogWeightModal>` and `<LogEatingModal>` on the corresponding quick-action buttons. The Med / Report Issue buttons still show "Coming soon" (Phase 6 + Phase 7).
- [x] **Immutable calorie accounting** — `eating_log_items.calories_per_gram_snapshot` captures the catalogue value at submission time; `estimated_kcal_consumed` is a `GENERATED ALWAYS AS ... STORED` Postgres column that multiplies `quantity_given_g × snapshot × eaten-ratio factor`. Historical reports stay stable even when admins later tweak `food_items.calories_per_gram` or flip items inactive.
- [x] **Translations** — new `weight.*`, `food.*`, `eating.*` groups in `messages/en.json` + `messages/id.json`; `nav.food` added for the sidebar entry.

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET / POST | `/api/cats/[id]/weight` | List (`?limit=` default 100, max 500) + log a new weight. Any active user may log; only admin may edit / delete (policy, not enforced here). |
| GET | `/api/cats/[id]/calorie-summary` | `{ recommended_kcal, today_kcal, last7_days: [{date, kcal}], latest_weight_kg }`. Calls the SQL helper `recommended_daily_kcal(p_cat_id)` and aggregates the last 8 days of meals into local-time day buckets. |
| GET / POST | `/api/cats/[id]/eating` | List recent meals (`?limit=` default 50) with embedded `items` + submitter + food. POST accepts `{ meal_time?, feeding_method, notes?, items: [{food_item_id, quantity_given_g, quantity_eaten}] }` and inserts the parent + item rows in two statements (with best-effort rollback if item insert fails). Snapshots `calories_per_gram` server-side — clients never send it. |
| GET / POST | `/api/food-items` | List (active by default; `?include_inactive=1` for the admin page). POST is admin-only. |
| PATCH / DELETE | `/api/food-items/[id]` | Admin-only. DELETE is soft (sets `is_active=false`). |

### Deviations from Spec
- **`weight_logs.photo_url`** — the column exists and is accepted by the POST body, but there's no photo-upload UI yet. Keeping the field so the shape is forward-compatible; the UI row will land in Phase 12 (Reports) or Phase 15 (Polish) when someone asks for it.
- **Admin reports** (§3.3 "Weight history table per cat", "multi-cat overlay", >10% drop flag, CSV export; §3.4.4 "All eating logs filterable", "Appetite trend", "Force-fed incidents log", "Export CSV") — explicitly deferred to **Phase 12 — Reports**. The per-cat WeightCard and EatingCard satisfy the single-cat surfaces; the admin reporting hub is its own phase.
- **Editing an existing weight or meal entry** — no UI. Deletion would re-trigger the kcal math correctly (stored generated column + RLS allow admin DELETE), but we haven't built the affordance. Add it in Phase 12 alongside the reports grid.
- **"Prominent at the top of the eating log form"** (§3.4.2) — `<LogEatingModal>` shows a live estimated-total-kcal strip at the bottom of the form instead of the recommended daily target. Rationale: the total-kcal-of-this-meal is what the sitter is actively shaping; the daily target is already surfaced upstream on the cat detail banner + EatingCard. Can add a compact "target: N kcal" line at the top of the modal if feedback warrants.
- **Life-stage multiplier presets UI** (§3.4.2 table) — not built. `cats.life_stage_multiplier` is editable as a numeric field in the existing cat form, so admins can set it to 1.2 / 1.4 / 2.5 / etc. by hand. A friendly preset dropdown can land in Phase 15.

### New Environment Variables
_None._

---

## Database Changes

### New Tables
| Table | Migration file | Notes |
|---|---|---|
| `weight_logs` | `20260416000000_phase4_daily_care.sql` | `weight_kg numeric(5,2)` with CHECK > 0 AND < 30. Indexed on `(cat_id, recorded_at DESC)`. |
| `food_items` | same | Admin catalogue. `calories_per_gram numeric(5,2)` with CHECK [0, 20]. Soft-delete via `is_active`. |
| `eating_logs` | same | One row per meal session. |
| `eating_log_items` | same | One row per food served. `calories_per_gram_snapshot` + `estimated_kcal_consumed` (GENERATED STORED). `food_item_id` uses `ON DELETE RESTRICT` — we never want historical logs to lose their food reference. |

### New Enums
- `food_type` — `wet | dry | raw | treat | supplement | other`
- `food_unit` — `g | ml | sachet | piece`
- `feeding_method` — `self | assisted | force_fed`
- `eaten_ratio` — `all | most | half | little | none`

### New Views / Functions
- **`public.cat_latest_weight`** view — `DISTINCT ON (cat_id)` of most recent weight per cat. Used by the recommended-kcal helper and by `<CatKcalBanner>` for the "latest weight" chip.
- **`public.recommended_daily_kcal(p_cat_id uuid) → numeric`** — `70 × weight_kg^0.75 × life_stage_multiplier`, rounded to the nearest kcal. Returns NULL when the cat has no weight logged yet (caller treats as "need weight first"). `STABLE` and plain SQL — safe to call from RPC without a transaction.

### RLS Policies Added
Spec §8.1: "Any Cat Sitter can submit any report ... for any cat — not just their assigned cats". The policies reflect that:

- `weight_logs` / `eating_logs` / `eating_log_items`: SELECT + INSERT for any `is_active_user()`; UPDATE + DELETE admin-only.
- `food_items`: SELECT for any active user; ALL writes admin-only (catalogue is curated).
- INSERT policies on logs enforce `submitted_by = auth.uid()` so sitters can't forge logs as somebody else.
- `eating_log_items` INSERT also checks the parent `eating_logs` row was submitted by the same user — prevents an active attacker from stuffing rows into someone else's meal.

### Edge Functions / pg_cron
_None._

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- **`calorie-summary` day bucketing uses server local time**, not a per-cat / per-cattery timezone. Fine for a single-site cattery but needs revisiting when multi-timezone comes up. Pass `?tz=Asia/Jakarta` or similar later.
- **Recent-meal list on `<EatingCard>` is client-fetched** (not embedded into the page's server fetch) — one extra round-trip on cat detail. Kept it simple because it needs to invalidate cleanly after a log-meal mutation; a server fetch + re-render would force `router.refresh()` noise on every meal.
- **No debounce / optimistic UI** on the Log modals — submit → toast → modal close → query invalidation → card re-renders. Latency is tiny but if someone logs ten meals in a row on slow mobile data, there'll be a visible flash per submission. Fine for Phase 4.
- **`<WeightCard>` delta heuristic** is purely visual (>10% → destructive color, any drop → amber). The spec's "flag if weight drops >10%" callout lands in Phase 12 alongside the admin report table. The color alone is not a substitute for a dashboard alert.
- **`<LogEatingModal>` food dropdown** isn't searchable — we reused the existing plain `<Select>`. For a catalogue > ~30 items the UX will degrade. Swap to a filtered combobox pattern similar to `<AssigneeSelect>` when it gets uncomfortable.
- **`eating_log_items` RLS on INSERT** requires the parent `eating_logs` row to already exist *with the same submitted_by*. The API inserts the parent first, then items — RLS will only ever see the parent present. This is safe but means admins cannot bulk-backfill items for another user's log via raw SQL-over-PostgREST without impersonation.

### Known Bugs
_None observed._ Typecheck + build clean.

### Cut from This Phase
- CSV export and the full admin reports hub (Phase 12).
- Weight photo upload (see deviation above).
- Life-stage multiplier preset dropdown.
- "Edit / delete an existing log" affordance for admins.
- Searchable food-item combobox.
- Per-cattery timezone config.

---

## Test Coverage

### What Is Tested
- **Typecheck** — `tsc --noEmit` clean.
- **Build** — `next build` produces 31 routes. (Had to `rm -rf .next` once to clear a stale route cache pointing at `/rooms` — noted in gotchas below.)

### What Is NOT Tested (Should Be)
- The `estimated_kcal_consumed` GENERATED STORED column — verify against real inserts that `quantity_given_g * calories_per_gram_snapshot * ratio_factor` rounds as expected. Trivial, but worth a single integration test.
- `recommended_daily_kcal(p_cat_id)` on a cat with no weight → should return NULL and the banner / EatingCard should show the "log a weight first" hint.
- RLS: Cat Sitter cannot DELETE their own weight_log even right after inserting.
- RLS: Cat Sitter cannot POST a meal with `submitted_by` spoofed to another user id.
- RLS: INSERT into `eating_log_items` referencing a parent `eating_logs` row owned by someone else fails.
- E2E: log a meal, open cat detail, confirm the kcal banner + EatingCard both update without a manual refresh.

---

## Notes for Next Agent

> Read this carefully before starting **Phase 5 — Preventive Health** (vaccinations + deworming/flea records and reminders per §3.6 / §3.7).

### Must-Read Files Before Starting
- `supabase/migrations/20260416000000_phase4_daily_care.sql` — the "snapshot + generated stored column" pattern for immutable calorie math. Reuse the same idea for anything that needs to survive a catalogue rename (e.g. prescription dose at time of admin vs later edits).
- `lib/schemas/eating.ts` — `EATEN_RATIO_FACTOR` is **intentionally duplicated** between TypeScript (for live total-kcal estimation in the modal) and the SQL `CASE` in the generated column. If you change one, change both — otherwise the live estimate and stored value diverge.
- `components/weight/weight-card.tsx` + `weight-sparkline.tsx` — the hand-rolled SVG chart pattern. Copy for vaccination-interval visualisations, deworming-due countdowns, etc.
- `components/eating/eating-card.tsx` — the "today vs target with 7-day bar mini-chart" pattern. Works for any daily-progress surface.
- `components/cats/cat-kcal-banner.tsx` — the hero-strip pattern to surface a single most-important metric at the top of a detail page. Re-use for "next vaccination due in N days" when Phase 5 lands.

### Non-Obvious Decisions
- **Calories-per-gram snapshot lives on the line item** (`eating_log_items.calories_per_gram_snapshot`), not on the food item. It's the single immutability anchor; the `GENERATED STORED` kcal column reads it. If you ever refactor to a normalized "calories history" table, make sure the stored column can still resolve its factor without a subquery (Postgres forbids subqueries in generated columns).
- **`food_items.id` uses `ON DELETE RESTRICT` in `eating_log_items`** — deliberate. Historical meal logs MUST preserve their food reference. That's why DELETE on food-items is soft (flip is_active), not hard.
- **`cat_latest_weight` is a VIEW, not a materialized view.** Small reads; no refresh overhead needed. Supabase's generated TS types DO include views (as of 2026-04 regen), so you can `.from('cat_latest_weight')` with full typing — but the generated types mark every field `| null` because PostgREST can't prove NOT NULL through `DISTINCT ON`. Wrap with a non-null assertion at the call site.
- **Weight-card delta colors do not map 1:1 to the spec's reporting flags.** Green = gain, amber = small drop, destructive = ≥10% change in either direction. The admin "drop > threshold" alert is reporting territory (Phase 12).
- **`<LogEatingModal>` sends only `food_item_id` + quantities** — the server looks up current `calories_per_gram` per item in one batched round-trip and snapshots server-side. Clients cannot forge calorie values. Keep it this way.
- **`recommended_daily_kcal` RPC is called via `supabase.rpc(...)`** in the calorie-summary endpoint. Its return type per the generated types is `number` — but Postgres sends numeric as string; supabase-js auto-parses. If you ever see "NaN" in production, make sure the regen still types the function's return as `number` and not `string`.

### Gotchas
- **Stale `.next` cache after deleting routes** — if you remove a page or API route from a previous phase (we didn't this round, but be careful during refactors), `next build` may still try to collect it from the `.next` cache. Fix: `rm -rf .next && npm run build`.
- **Day buckets reuse `new Date()`** on the server. If your server clock ever skews into a different day than the users', the "today" bucket will be wrong. Move to per-cattery timezone config before multi-site.
- **`<LogEatingModal>` total-kcal estimate uses the CURRENT catalogue value, not the snapshot.** It's intentional for live feedback — the value actually stored is the snapshot at submit time. If an admin edits `calories_per_gram` while a sitter has the modal open, the sitter sees the new number in the preview and the snapshot reflects that same number on submit. No mismatch in the stored row; just an edge case worth knowing about.
- **Food soft-delete ≠ catalogue hidden from history.** Inactive items still appear in historical meals (because `eating_log_items.food_item_id` FK is unconditional). `<LogEatingModal>` correctly hides them from the dropdown via the `is_active` filter on the active list.
- **types.ts aliases block keeps getting wiped** on every `supabase gen types`. Phase 4 added five new tables + four enums; the block at the bottom of `lib/supabase/types.ts` now has: `WeightLog, FoodItem, EatingLog, EatingLogItem` and `FoodType, FoodUnit, FeedingMethod, EatenRatio`. Re-append after any regen.
- **`.next` trace files may briefly point at deleted routes** after a phase restructure — if a future phase moves the sitter shell again, expect to clean-rebuild.

### Context on Shared Components / Utils
- **`<LogWeightModal catId catName?>`** — drops a weight; invalidates `['weight', catId]`, `['calorie-summary', catId]`, `['cat', catId]`, `['me-cats']` and then `router.refresh()`.
- **`<LogEatingModal catId catName?>`** — multi-row meal log; same invalidation shape but for `['eating', catId]` + `['calorie-summary', catId]`. Refetches `food-items` on open (`enabled: open`) so a freshly-added catalogue item is visible without reopening.
- **`<CatKcalBanner catId>`** — compact hero strip; safe to mount anywhere a cat id is known. No internal modals — purely a readout.
- **`<WeightCard catId>`** — self-contained; renders its own Log button + modal. Drop it on any cat-scoped surface.
- **`<EatingCard catId>`** — same shape as WeightCard. Depends on `food_items` existing (empty dropdown otherwise). Spec §3.4.1 makes this explicit — admin seeds the catalogue first.
- **`<FoodItemsClient>`** — generic admin CRUD pattern; the create/edit sheet is also inlined here (`<FoodSheet>`). Reusable scaffold for any future catalogue (deworming products, vaccines).

---

## Spec Updates This Phase

_None._ `cattery-management-spec.md` unchanged.

---

## Next Phase Preview

**Phase 5 — Preventive Health** (§3.6 Vaccination Records & Reminders, §3.7 Deworming & Flea Treatment Records & Reminders).

Expected work (ballpark):
- **DB**: `vaccines`, `vaccinations`, `deworming_flea_products`, `deworming_flea_treatments`; reminder views or scheduled functions for "due within N days" queries.
- **API**: per-cat GET + POST for each; a global "upcoming reminders" endpoint for the dashboard.
- **UI**:
  - Cat detail: "Vaccinations" + "Preventive treatments" cards with history + due-next chip.
  - `<LogVaccineModal>`, `<LogDewormingModal>`.
  - Admin dashboard widget: "Overdue across all cats".
  - `/my-cats` per-cat card: surface due-today / overdue preventive care alongside meds in Phase 6.
- **Reminder engine**: start simple — client-side "days since last" math over fetched records, plus optional `pg_cron` polling view for the admin dashboard.

Key files the next agent will likely touch:
- `supabase/migrations/20260417000000_phase5_preventive_health.sql`
- `lib/schemas/vaccines.ts`, `lib/schemas/deworming.ts`
- `app/api/cats/[id]/vaccinations/route.ts`, `.../deworming/route.ts`
- `components/vaccines/*`, `components/deworming/*`
- `components/cats/cat-detail.tsx` — two more cards
- `app/(app)/vaccines/page.tsx` (admin catalogue) if spec needs per-vaccine presets

Smoke-test before starting Phase 5: apply Phase 4 migration, create one food item (`calories_per_gram = 3.5`), log a weight on a cat, log a meal with 100 g "All" eaten → cat detail should show `~350 kcal / <target>` on the banner and a meaningful progress bar. Deactivate the food item, reopen Log Meal → it should be gone from the dropdown. Reopen cat detail → history still shows the meal with the old item name.
