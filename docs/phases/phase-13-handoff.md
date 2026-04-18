# Phase 13 — Stock & Spending — Handoff

**Completed by:** Claude (opus-4-7)
**Completed at:** 2026-04-18
**Branch:** `claude/stock-management-system-66N5g`
**Spec version ref:** §5 Stock Management System, §9 Financial Accounting

---

## What Was Built

A full stock/inventory system with physical location tracking, append-only
movement ledger, FIFO expiry nudging, cat-sitter checkout, and a minimal
finance foundation that automatically records stock purchases as expense
transactions and surfaces a spending report.

### Features & Screens
- [x] **Stock overview** (`/stock`) — item list with on-hand qty, low-stock
      and expiry badges, search + filters, quick checkout CTA.
- [x] **Item catalogue CRUD** (`/stock/items`, admin) — name, brand, category,
      unit, min threshold, default location, photo URL, notes.
- [x] **Location management** (`/stock/locations`, admin) — physical places
      where stock lives (pantry, fridge, vet cabinet, quarantine cupboard…).
      Cold-storage flag.
- [x] **Item detail** (`/stock/[itemId]`) — all batches sorted earliest-expiry,
      per-batch transfer + adjust (admin), stock-in form, recent movements,
      cost display.
- [x] **Stock-in** — admin form that creates a batch via `stock_in()` RPC
      (atomic batch + movement + auto finance trigger).
- [x] **Checkout modal** (sitter + admin) — pick item → pick batch (earliest
      expiry suggested, any batch allowed) → qty → optional cat link →
      optional reason. Per-batch expiry badges (red ≤14d, amber ≤30d).
- [x] **Transfer** (admin) — moves a batch to a new location (qty unchanged,
      logged).
- [x] **Adjust** (admin) — manual qty correction with reason (auto-tags
      `discard` if reason mentions expiry).
- [x] **Movement ledger** (`/stock/movements`) — global append-only log with
      filters by type, location, since date.
- [x] **Spending report tab** in `/reports` — total spent by currency,
      breakdown by category, recent transactions, CSV export.
- [x] **Dashboard cards** — low-stock count + 14d expiring batch count with
      top-3 preview lists.
- [x] **Nav wiring** — admin sidebar "Stock" entry; sitter bottom tab "Stock".
- [x] **Full i18n** — every string in both `en.json` and `id.json`.

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET | `/api/stock/locations` | List locations (?include_inactive=1) |
| POST | `/api/stock/locations` | Create (admin) |
| PATCH | `/api/stock/locations/[id]` | Update (admin) |
| DELETE | `/api/stock/locations/[id]` | Soft-deactivate (admin) |
| GET | `/api/stock/items` | List items (?include_inactive, ?category) |
| POST | `/api/stock/items` | Create (admin) |
| GET | `/api/stock/items/[id]` | Detail + batches |
| PATCH | `/api/stock/items/[id]` | Update (admin) |
| DELETE | `/api/stock/items/[id]` | Soft-deactivate (admin) |
| GET | `/api/stock/batches` | List batches (?stock_item_id, ?location_id, ?available_only) |
| POST | `/api/stock/batches` | Stock-in → `stock_in()` RPC (admin) |
| GET | `/api/stock/batches/[id]` | Batch + its movements |
| POST | `/api/stock/checkout` | Sitter checkout → `stock_checkout()` RPC |
| POST | `/api/stock/transfer` | Admin transfer → `stock_transfer()` RPC |
| POST | `/api/stock/adjust` | Admin adjust → `stock_adjust()` RPC |
| GET | `/api/stock/movements` | Filtered ledger w/ joined batch+item+cat+mover |
| GET | `/api/stock/status` | Per-item aggregate (low-stock flag, earliest expiry) |
| GET | `/api/stock/expiring` | Batches expiring within ?days (default 30) |
| GET | `/api/finance/categories` | List (?type=income/expense, ?include_inactive) |
| POST | `/api/finance/categories` | Create (admin) |
| PATCH | `/api/finance/categories/[id]` | Update (admin) |
| DELETE | `/api/finance/categories/[id]` | Soft-delete (admin, blocked for system rows) |
| GET | `/api/finance/transactions` | List (admin only) w/ joined category |
| POST | `/api/finance/transactions` | Manual entry (admin) |
| PATCH | `/api/finance/transactions/[id]` | Edit (admin) |
| DELETE | `/api/finance/transactions/[id]` | Hard delete (admin) |
| GET | `/api/finance/summary` | Monthly summary view (admin) |

### Deviations from Spec
- **Separate stock_locations table** instead of reusing `rooms` — product
  decision (user ask). Rooms hold cats, locations hold items; mixing them
  would muddle RLS and mental model.
- **FIFO is a UX nudge, not a hard rule.** Spec §5 mentions FIFO batch
  tracking; per user request, sitters can override — the UI always
  highlights the earliest-expiry batch and marks it `Suggested`, but any
  batch with remaining qty can be chosen.
- **Finance scope is intentionally minimal.** Only stock-purchase
  auto-transactions are wired. Payroll, vet, adoption, manual income etc.
  use the same `financial_transactions` + `transaction_categories` shape
  (no schema rework required when they land).
- **Spending report shipped as a tab inside `/reports`** rather than a
  dedicated finance page. Full finance ledger/page comes in Phase 14.

### New Environment Variables
None.

---

## Database Changes

### New Tables
| Table | Migration | Notes |
|---|---|---|
| `stock_locations` | `20260505000000_phase13_stock.sql` | Physical storage places |
| `stock_items` | `20260505000000_phase13_stock.sql` | Catalogue |
| `stock_batches` | `20260505000000_phase13_stock.sql` | Per-purchase lots (expiry, cost, location) |
| `stock_movements` | `20260505000000_phase13_stock.sql` | Append-only ledger |
| `transaction_categories` | `20260506000000_phase13_finance_foundation.sql` | Seeded with 16 default rows |
| `financial_transactions` | `20260506000000_phase13_finance_foundation.sql` | Generic income/expense ledger |

### New Views
- `public.stock_item_status` — per-item on-hand, low-stock flag, earliest expiry
- `public.stock_expiring_batches` — batches with qty>0 and expiry ≤ 30d
- `public.finance_monthly_summary` — rollup by month/type/category/currency

### New RPCs
- `stock_in(p_stock_item_id, p_qty, p_location_id, p_expiry_date, p_cost_per_unit, p_currency, p_batch_ref, p_notes, p_received_at)` — admin only, creates batch + movement atomically.
- `stock_checkout(p_batch_id, p_qty, p_for_cat_id, p_reason)` — any active user.
- `stock_transfer(p_batch_id, p_to_location_id, p_reason)` — admin only.
- `stock_adjust(p_batch_id, p_qty_delta, p_reason)` — admin only.

### Triggers
- `apply_stock_movement()` on `INSERT stock_movements` — mutates batch
  `qty_remaining` via signed delta, updates `location_id` for transfers.
  SECURITY DEFINER so sitter-signed checkout rows can decrement batches
  without granting sitters direct write on `stock_batches`.
- `handle_stock_in_financial()` on `INSERT stock_movements` — when
  `type='stock_in'` and batch has `cost_per_unit`, inserts an
  `auto_generated=true` Expense transaction under **Stock Purchase**,
  linked via `related_entity_type='stock_batch'`.

### RLS Policies
- `stock_locations`, `stock_items`, `stock_batches`: admin full CRUD;
  active users SELECT.
- `stock_movements`: active users SELECT; active users INSERT where
  `moved_by = auth.uid()`; admin UPDATE/DELETE.
- `transaction_categories`: active users SELECT (so category names render
  anywhere), admin full CRUD.
- `financial_transactions`: **admin only, both read and write**. Sitters
  never see finance totals (spec §9.4.3).

### Edge Functions / pg_cron
None.

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- `types.ts` isn't regenerated; new tables are accessed via
  `(supabase as any).from(...)` — matching the Phase 9 / 10 / 12 pattern.
  Regenerate with `supabase gen types typescript` post-deploy and remove
  the `any` casts over time; also uncomment entries in
  `lib/supabase/aliases.ts` to replace the local `stock-types.ts`.
- Manual Income/Expense entry UI is **not built** — the POST
  `/api/finance/transactions` endpoint exists and the ledger table is
  ready, but a dedicated admin form lives in Phase 14.
- `photo_url` on `stock_items` is a free-form string input; no Supabase
  Storage bucket wired for stock photos yet. Phase 14 or a follow-up can
  add an `item-photos` bucket if product wants uploads.

### Known Bugs
| Bug | Steps to reproduce | Severity |
|---|---|---|
| Stock-in currency defaults to "IDR" in the modal regardless of system settings value | Open Stock-in with a non-IDR system currency, cost field respects but currency always preloads IDR | Low |

### Cut from This Phase
- Full Finance page (manual ledger entry, income manual entries,
  payroll, transfer-proof uploads) — Phase 14.
- Stock-item photo uploads via Supabase Storage.
- Batch-level CSV export (only the transactions CSV ships here).
- Offline queueing of checkout actions via `background_sync_queue`
  (current flow is online-only; sitters see a toast error if offline).

---

## Test Coverage

### What Is Tested
- Build & typecheck pass (`yarn build`, `yarn typecheck`).
- JSON validity of both locale files.

### What Is NOT Tested (Should Be)
- RPC behaviour under concurrent writes (two sitters checking out the same
  batch simultaneously) — Postgres FOR UPDATE in `apply_stock_movement` is
  there but untested.
- RLS paths: verify sitter cannot direct-INSERT `stock_batches` or
  `financial_transactions`; verify sitter INSERT on `stock_movements` is
  limited to own `moved_by`.
- Finance trigger when `cost_per_unit=0` (should skip).

---

## Notes for Next Agent

### Must-Read Files Before Starting
- `supabase/migrations/20260505000000_phase13_stock.sql` — core data model,
  the `apply_stock_movement` trigger is where every qty change happens.
- `supabase/migrations/20260506000000_phase13_finance_foundation.sql` —
  slug-based lookup in the stock-in trigger means category seeds must stay
  present. `is_system=true` rows are guarded against delete.
- `components/stock/stock-checkout-modal.tsx` — the "sitter picks a batch"
  UX. Note `daysBetween` and `useEffect` that auto-selects the first batch.
- `components/stock/stock-item-detail-client.tsx` — the admin/sitter detail
  page with embedded stock-in, transfer, adjust modals.

### Non-Obvious Decisions
- **Movements never hand-update batches.** Every qty/location change must
  route through `apply_stock_movement`. If you add a new movement type,
  update the trigger and the `stock_movement_type` enum together.
- **Batch deletion is blocked** (`ON DELETE RESTRICT` from movements →
  batches → items). Deactivation is soft. This preserves cost history for
  finance reports.
- **Sitters can INSERT stock_movements directly** (not just via RPC) to
  support future offline-queued checkouts — the policy checks
  `moved_by = auth.uid()` and the apply-trigger still validates remaining
  qty. If you add a more destructive movement type, gate it in an RPC.
- **`(supabase as any)`** is used everywhere new — mirror Phase 10. Keep
  the eslint-disable comments until `types.ts` regen.

### Gotchas
- `stock_items.default_location_id` uses `ON DELETE SET NULL` — soft-delete
  of a location doesn't null it; only a hard delete would. Hard deletes of
  locations are not exposed through the API.
- The finance trigger uses `v_batch.qty_initial`, not `qty_remaining` —
  the Expense amount reflects what was *received*, not what's left.
- `stock_movements.qty_delta` for `stock_in` is `+qty_initial`; for
  `transfer` it's `0`; everything else is negative (or signed for
  `adjust`). The ledger is signed — no separate "quantity_in" /
  "quantity_out" columns.

### Context on Shared Components / Utils
- `ResponsiveModal` — existing shadcn/vaul hybrid, same shape used in food,
  rooms, vet modals.
- `ReportShell` — reused in `SpendingReport` for date-range + export.
- `StockCheckoutModal` — reused on both the overview page and the item
  detail page via `presetItemId` prop.

---

## Spec Updates This Phase
| Section | Change | Reason |
|---|---|---|
| §5 | FIFO is documented as a UX nudge, not enforced | Product owner requested sitter override |
| §9 (partial) | Foundation shipped early to support Phase 13 spending visibility | Avoids schema rework when full finance lands |

---

## Next Phase Preview

**Phase 14 — Finance (full)**

Build on the foundation shipped in Phase 13:
- Income manual entry
- Payroll entries + salary history + transfer-proof uploads
- Auto-trigger for vet visits (`visit_cost`, `transport_cost`)
- Auto-trigger for adoption records (income)
- Dedicated `/finance` admin page (full ledger with filters, receipts bucket)
- "My Payroll" sitter page (own rows only)

Key files Phase 14 will likely touch:
- `app/(app)/finance/` (new)
- `components/finance/` (new; `components/finance/` directory is already
  created but empty)
- New migrations for `profile_salaries`, `payroll_entries`
- Additional triggers on `vet_visits` and adoption tables

Relevant spec sections:
- §9 — Financial Accounting (already partly implemented)
- §9.4 — Payroll & Salary
