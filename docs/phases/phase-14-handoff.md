# Phase 14 — Finance & Payroll — Handoff

**Completed by:** Claude (opus-4-7)
**Completed at:** 2026-04-20
**Branch:** `claude/finance-payroll-next-phase-skTIj`
**Spec version ref:** §9 Financial Accounting, §9.4 Payroll & Salary

---

## What Was Built

The full Finance & Payroll surface on top of the Phase 13 foundation. Manual
income/expense entry, vet-visit auto-triggers, per-sitter salary history,
monthly payroll generation, transfer-proof uploads, and a sitter-facing
"My Payroll" page.

### Features & Screens
- [x] **/finance** (admin) — Full ledger with from/to, type, category, and
      manual/auto source filters. Totals card per currency (income, expense,
      net). Manual income + expense entry with receipt upload. Inline
      edit/delete for manual rows (auto rows stay read-only and linked to
      their source).
- [x] **/finance/payroll** (admin) — Three sections:
      (1) Active salaries per active user, with an inline "edit" that writes
      a new `profile_salaries` row (history is kept).
      (2) Salary history disclosure.
      (3) Payroll-entries grid with period filter + **Generate payroll**
      button that seeds pending rows for every user with an active salary.
      Each row supports *Mark paid* (date + method + reference + proof
      upload), *Edit*, *Delete*.
- [x] **/my-payroll** (sitter) — Current salary card + list of own payroll
      rows with paid/pending status and a signed "View transfer proof" link
      for paid rows.
- [x] **Auto-triggers** — see Database Changes below.
- [x] **Full i18n** — `finance.*` block in both `en.json` and `id.json`,
      plus `nav.finance`, `nav.payroll`, `sitterNav.myPayroll`, and
      `common.export`.
- [x] **Nav wiring** — admin sidebar gets Finance + Payroll entries under
      the "Manage" section. Sitter bottom tab bar gets a Payroll tab.
      Admin-sidebar `NavItem` grew an `exact?: boolean` flag so `/finance`
      only lights up on the exact path (otherwise `/finance/payroll` would
      activate both).

### API Routes Added
| Method | Path | Description |
|---|---|---|
| GET | `/api/finance/salaries` | List salaries (?profile_id filter) — admin |
| POST | `/api/finance/salaries` | New salary row — admin |
| PATCH | `/api/finance/salaries/[id]` | Update — admin |
| DELETE | `/api/finance/salaries/[id]` | Hard delete — admin |
| GET | `/api/finance/payroll` | List entries (filters: profile_id, status, from, to) — admin |
| POST | `/api/finance/payroll` | Create entry — admin |
| GET | `/api/finance/payroll/[id]` | Fetch one — admin or owner (RLS) |
| PATCH | `/api/finance/payroll/[id]` | Update — admin (recomputes net if gross/bonus/deduction changed and net wasn't sent) |
| DELETE | `/api/finance/payroll/[id]` | Delete + remove linked ledger row — admin |
| POST | `/api/finance/payroll/generate` | Seed pending rows for `{year, month}` from each active salary — admin |
| GET | `/api/finance/payroll/me` | Own entries + current salary — any active user |
| GET | `/api/finance/payroll/[id]/proof` | Short-lived signed URL for transfer proof — admin or owner |
| DELETE | `/api/finance/payroll/[id]/proof` | Remove stored file + clear columns — admin |
| POST | `/api/finance/attachments` | Multipart upload → `finance-attachments` bucket (payroll or receipt) — admin |

### Deviations from Spec
- **Adoption auto-trigger is not wired.** Spec §9 and §10 describe an
  `adoption_records` table, but Phase 1 `cats` has no adoption fields and
  the adoption schema hasn't been created yet. The category
  `adoption_fee` was already seeded in Phase 13 and the
  `financial_transactions.related_entity_type` enum already contains
  `'adoption'` — the trigger + table land in the adoption phase.
- **Transfer-proof bucket is private.** Spec is silent on privacy; we kept
  `finance-attachments` non-public so sitters cannot scrape URLs from the
  network tab. Proof display always goes through a server-signed URL.
- **Manual receipt URL stays free-form.** The upload helper returns a
  30-day signed URL which we drop straight into `receipt_url`; admins can
  also paste any external URL. No signature refresh loop — if the signed
  URL expires, re-upload.
- **Auto-transactions are synced in place on vet visit edits** (delta
  instead of delete + re-insert) so admins keep the same ledger ID when
  they correct a cost typo.

### New Environment Variables
None.

---

## Database Changes

### New Tables
| Table | Migration | Notes |
|---|---|---|
| `profile_salaries` | `20260509000000_phase14_finance_payroll.sql` | Per-profile base salary with `effective_from` history |
| `payroll_entries` | same | Per-period payout, gross/bonus/deduction/net, status, transfer proof, link to ledger |

### New Enums
- `payroll_status` — `pending`, `paid`, `cancelled`.

### New Views
- `finance_payroll_status` — payroll entries joined to profile name (for
  admin dashboards / future widgets).

### New Triggers
- `handle_payroll_financial()` on `payroll_entries` INSERT + conditional
  UPDATE (status / net / payment_date / method / proof / reference). When
  a row becomes `paid`, inserts or syncs a `financial_transactions` row
  under `staff_payroll` and stores the ledger ID back on the entry. When a
  row flips *away* from paid, the linked ledger row is kept but the
  `financial_txn_id` is cleared so a future "paid" creates a fresh row.
- `handle_vet_visit_financial()` on `vet_visits` INSERT + conditional
  UPDATE (visit_cost, transport_cost, visit_date, cat_id). Creates up to
  two ledger rows (one per cost type, under `vet_medical` / `transport`).
  On edit, existing auto rows are updated in place; setting a cost to 0/NULL
  removes the corresponding auto row.
- Existing `handle_stock_in_financial()` (Phase 13) is unchanged.
- A one-shot backfill at the bottom of the migration re-runs the vet
  trigger against any pre-existing vet visits that already had costs.

### RLS Policies
- `profile_salaries` — admin full CRUD; profile-owner SELECT own rows.
- `payroll_entries` — admin full CRUD; profile-owner SELECT own rows.
- Existing `financial_transactions` admin-only policy (Phase 13) is
  unchanged — sitters never see the full ledger.

### Storage Bucket
- `finance-attachments` (private). RLS: admin-only for select/insert/
  update/delete. Sitters fetch their own proofs via
  `/api/finance/payroll/[id]/proof`, which signs the URL server-side
  using the service-role client.

### Edge Functions / pg_cron
None.

---

## Known Issues & Shortcuts

### Intentional Tech Debt
- **Types not regenerated.** New tables/columns are accessed via
  `(supabase as any).from(...)` everywhere in API routes, matching the
  Phase 10/12/13 pattern. Regenerate with
  `supabase gen types typescript` post-deploy; then uncomment the new
  aliases you want in `lib/supabase/aliases.ts` and replace the `any`
  casts file-by-file.
- **`FinancialTransaction` is cast to `Record<string,unknown>` for CSV
  export.** `toCsv` is strict about row shape. The cast is intentional
  and localised to the export call site.
- **Finance overview has no chart.** Per-month bar or line chart of
  income vs expense would be a nice add but was intentionally skipped to
  avoid a new Recharts dependency; the page already leans heavily on
  cards/totals, which is enough for the first shipping version.

### Known Bugs / Edge Cases
| Bug | Steps to reproduce | Severity |
|---|---|---|
| Delete of a *paid* payroll entry also removes the linked ledger row, which is correct for mistakes but surprising for history — deleting a cancelled entry doesn't touch the ledger (none to remove). | Create payroll, mark paid, delete. The linked Expense disappears from the ledger too. | Low |
| Vet auto-trigger `transport_cost` and `visit_cost` use `system_settings.default_currency` — editing a historical visit whose currency was once different won't carry the old currency. | Visit ledgered in IDR before spec change; later the default becomes USD; editing the visit re-stamps the auto row as USD. | Low |

### Cut from This Phase
- Adoption auto-trigger (adoption_records table doesn't exist yet).
- Bank-account register / reconciliation.
- Recurring / scheduled payroll (once per month cron).
- Export endpoints beyond the client-side CSV.
- Multi-currency net totals — the finance dashboard surfaces each
  currency separately; it does not attempt FX conversion.

---

## Test Coverage

### What Is Tested
- `yarn typecheck` and `yarn build` both pass.
- JSON validity of both locale files.

### What Is NOT Tested (Should Be)
- Full RLS matrix:
  - sitter cannot SELECT `financial_transactions` or `profile_salaries`
    for *other* profiles.
  - sitter can SELECT own `payroll_entries` and `profile_salaries`.
  - sitter cannot INSERT into `payroll_entries`.
- Trigger behavior:
  - payroll INSERT with `status='paid'` creates a ledger row.
  - payroll UPDATE paid → cancelled clears `financial_txn_id` but keeps
    the ledger row.
  - vet_visit UPDATE setting `visit_cost` to NULL removes the linked
    ledger row but keeps the transport one.
- Storage RLS: sitter cannot direct-download a proof from another user's
  payroll entry via the private bucket.

---

## Notes for Next Agent

### Must-Read Files Before Starting
- `supabase/migrations/20260509000000_phase14_finance_payroll.sql` —
  every auto-trigger contract lives here. The trigger functions are
  SECURITY DEFINER, so they bypass RLS when writing to
  `financial_transactions`. Read the trigger WHEN clauses carefully if
  you're adding a new cost column to `vet_visits` — you must extend the
  `UPDATE … when (…)` list or changes will silently not flow.
- `components/finance/finance-client.tsx` — how filter state flows through
  `/api/finance/summary` for the totals card and
  `/api/finance/transactions` for the ledger list.
- `components/finance/payroll-client.tsx` — salary modal writes a *new*
  row (doesn't update an existing one); the PayModal is a dedicated flow
  because it bundles file upload + PATCH into one action.
- `app/api/finance/payroll/generate/route.ts` — the "latest active
  salary" logic (latest-wins) is duplicated client-side in
  `PayrollClient.activeSalary`. If you change the rule, update both.

### Non-Obvious Decisions
- **Payroll generate never overwrites** — if a `(profile_id, period_start,
  period_end)` row already exists the user is silently skipped. The
  unique constraint on those three columns is the real safety net.
- **Proof file is detached from the entry's `transfer_proof_url` on
  delete of the proof alone** — we clear both columns but the entry row
  survives. This is intentional so an admin can re-upload without
  touching ledger state.
- **Finance amount column is stored, not computed** — payroll `net_amount`
  is populated by the API before insert/update so admins can override (a
  manual correction like "net = gross + bonus − deduction − tax rounded
  down"). The client UI always shows the computed formula but sends the
  stored value to the server.
- **Vet backfill is idempotent** — it only touches visits that have no
  existing ledger row keyed on the visit id. Safe to re-run.

### Gotchas
- `financial_related_entity_type` already contains `'adoption'` from
  Phase 13's seed. Do not alter the enum when you add the adoption
  trigger — just use the slug `adoption_fee`.
- Editing a payroll entry back from `paid` → `pending` does NOT roll back
  the expense row. The trigger only clears the link; the ledger row
  remains and becomes orphaned. This is intentional so the finance totals
  stay stable across admin flip-flopping, but delete the ledger row
  manually if you truly need to reverse a payment.
- The sitter bottom-tab bar now has 5 tabs (My Cats / All Cats / Stock /
  Payroll / Profile) — if you add a sixth, validate on a small-screen
  viewport (<340px) where the label truncation starts to bite.
- `app/(app)/my-payroll/page.tsx` does *not* gate on role — admins can
  open it too and see their own payroll. That's fine; the real owner
  check happens via RLS in the API route.

### Context on Shared Components / Utils
- `ResponsiveModal` — same component used across Stock, Vet, Health
  surfaces.
- `useForm` + `zodResolver` — matches the stock/vet pattern. The
  `payrollEntrySchema` has two `.refine()` checks (period_end ≥
  period_start, paid requires payment_date). When validation fails,
  the client surfaces the first error via toast so submit buttons never
  feel "dead".
- `lib/export/csv.ts` — finance CSV export reuses the stock-spending
  pattern.
- `createServiceRoleClient` — used only inside the proof route to sign
  URLs for owner reads that would otherwise be blocked by the
  admin-only bucket RLS.

---

## Spec Updates This Phase
| Section | Change | Reason |
|---|---|---|
| §9.4.2 | `payroll_entries` adds `bonus_amount`, `deduction_amount` in addition to `gross_amount` / `net_amount`; `status` enum (`pending`, `paid`, `cancelled`) instead of "payment_date implies paid" | Easier to query pending payouts; matches the admin mental model |
| §9.4 | Transfer proofs live in a **private** bucket served via signed URL, not a public `avatars`-style path | Payslip data shouldn't be scrapeable from the network tab |
| §9 | Vet-visit auto-trigger syncs in place on edit rather than replacing | Preserves ledger IDs across cost corrections |

---

## Next Phase Preview

**Phase 15 — Adoption Records**

Blocking work:
- `adopters` + `adoption_records` tables.
- Adoption auto-trigger on status → Completed: creates Income under
  `adoption_fee` (category already seeded). The
  `financial_transactions.related_entity_type='adoption'` slot is already
  reserved.
- UI: adoption record list + detail + mark-completed flow; link to cat
  status → `sold`.

Other candidates:
- Per-month income/expense chart on `/finance`.
- Recurring salary cron (auto-generate payroll on the 1st of each month).
- Dashboard tiles for pending payroll and unpaid vet visits.

Relevant spec sections:
- §9.2 / §9.3 — auto-trigger contract for adoption income.
- §10 — Adoption Management.
