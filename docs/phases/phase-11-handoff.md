# Phase 11 — Reports — Handoff

**Completed by:** Claude (Sonnet 4.6)
**Completed at:** 2026-04-13
**Spec version ref:** `cattery-management-spec.md` §11.2 (Reporting Hub) + §11.1 (Admin Dashboard)

---

## What Was Built

### Shared infrastructure
- **`lib/export/csv.ts`** — type-safe `toCsv(rows, columns)` serialiser + browser `downloadCsv()` helper. No dependencies. Quotes/escapes properly. Handles null/undefined/Date/boolean/object coercion.
- **`components/reports/report-shell.tsx`** — every report wraps in `<ReportShell>` which provides title, description, date range pickers, and an "Export CSV" button. Calls back into the section component with the chosen `{ from, to }` range.
- **`components/reports/charts.tsx`** — hand-rolled SVG `<LineChart>` and `<BarChart>` (no library). Multi-series support, auto-scaling, theme-aware colours via tailwind `currentColor`. Mirrors the existing `WeightSparkline` pattern, just generalised.

### Reports Hub
- **`app/(app)/reports/page.tsx`** → `<ReportsClient>` with 9 tabs:

| Tab | Section | Endpoint | Highlights |
|---|---|---|---|
| Weight | `weight-report.tsx` | `/api/reports/weight-logs` | Multi-series line chart + table; CSV |
| Eating | `eating-report.tsx` | `/api/reports/eating-logs` | Total grams + total kcal cards; flattened CSV (one row per food item) |
| Medication | `medication-compliance-report.tsx` | `/api/reports/medication-compliance` | Per plan: confirmed/missed/pending/skipped + compliance rate (colour-coded) |
| Vaccinations | `vaccinations-report.tsx` | `/api/reports/vaccinations` | Overdue rows highlighted red |
| Vet visits | `vet-visits-report.tsx` | `/api/reports/vet-visits` | Visit + transport cost totals |
| Health tickets | `health-tickets-report.tsx` | `/api/reports/health-tickets` | Severity bar chart + avg time-to-resolve |
| Heat cycles | `heat-logs-report.tsx` | `/api/reports/heat-logs` | Per-cat avg interval calculation |
| Room movements | `room-movements-report.tsx` | `/api/reports/room-movements` | Movement audit trail |
| Activity | `activity-report.tsx` | `/api/reports/activity` | **Unified audit feed** — combines assignee changes, room moves, weight logs, ticket creations and vet visits into one chronological list with kind badges |

All API routes are admin-only, accept `?from=&to=&cat_id=` filters, and return JSON. CSV serialisation happens client-side from the same data.

### Admin Dashboard (§11.1)
Rewrote `app/(app)/page.tsx` to add widgets:
- **Open health tickets** with severity breakdown chips
- **Upcoming vaccinations** (next 30 days) — top 3 with cat name + due date
- **Upcoming preventive treatments** (next 30 days)
- **Vet follow-ups** (next 14 days)
- **Recent tickets feed** (last 8)
- "Reports" link added to Quick Actions
- All queries run in a single `Promise.all` for efficiency

### Skipped from §11.2 (need other phases)
- Stock movement (deferred)
- Financial ledger / summary / payroll (Phase 13 Finance)
- Adoption report (Phase 14 Adoption)

---

# Phase 12 — System Settings — Handoff

**Spec version ref:** `cattery-management-spec.md` §11.3 (System Settings)

## What Was Built

### Database
- **`system_settings`** — single-row config table (enforced via `id = 1` check)
  - `cattery_name`, `cattery_logo_url`, `default_currency`
  - `gestation_days` (default 63) — used by Phase 9 mating records
  - `vaccination_lead_days`, `preventive_lead_days`, `vet_followup_lead_days` — reminder windows
  - `weight_drop_alert_pct` (default 10) — threshold for the weight-drop banner
  - `push_notifications_enabled`
  - `updated_at` trigger + `updated_by` FK
- **RLS**: all authenticated users can read; only admins can update
- Singleton row seeded automatically on migration

### API
- **`/api/settings`** GET (all) + PATCH (admin only) — uses `systemSettingsSchema.partial()` for partial updates

### UI
- **`app/(app)/settings/page.tsx`** + **`components/settings/settings-client.tsx`** — admin-only form grouped into Branding / Health & breeding / Notifications sections
- All number inputs use min/max constraints matching the DB checks
- Submits via `useMutation`; on success, toast + cache update

### Sidebar
- New "Insights" section in `admin-sidebar.tsx` containing:
  - **Reports** (`BarChart3` icon → `/reports`)
  - **Settings** (`Settings` icon → `/settings`)

### Translations
- `messages/en.json` + `messages/id.json` — added `nav.reports`, `adminNav.sectionInsights`, full `reports` + `settings` sections, `adminDashboard` widget labels

---

## Migration

```bash
supabase db push
supabase gen types typescript --local > lib/supabase/types.ts
```

Then uncomment in `lib/supabase/aliases.ts`:
```ts
export type SystemSettings = Database['public']['Tables']['system_settings']['Row']
```

And strip `(supabase as any)` casts in:
- `app/api/settings/route.ts`
- `app/api/reports/health-tickets/route.ts`
- `app/api/reports/vet-visits/route.ts`
- `app/api/reports/eating-logs/route.ts`
- `app/api/reports/medication-compliance/route.ts`
- `app/api/reports/heat-logs/route.ts`
- `app/api/reports/room-movements/route.ts`
- `app/api/reports/activity/route.ts`

---

## Files Added / Modified

### New
| File | Purpose |
|---|---|
| `lib/export/csv.ts` | CSV serialiser + downloader |
| `lib/schemas/system-settings.ts` | Zod schema |
| `components/reports/report-shell.tsx` | Shared report wrapper |
| `components/reports/charts.tsx` | LineChart + BarChart (SVG) |
| `components/reports/reports-client.tsx` | Tabbed reports hub |
| `components/reports/sections/*.tsx` | 9 report sections |
| `components/settings/settings-client.tsx` | Settings form |
| `app/(app)/reports/page.tsx` | Reports route |
| `app/(app)/settings/page.tsx` | Settings route |
| `app/api/reports/*/route.ts` | 9 report API routes |
| `app/api/settings/route.ts` | Settings GET/PATCH |
| `supabase/migrations/20260425000000_phase12_system_settings.sql` | system_settings table |

### Modified
| File | Change |
|---|---|
| `app/(app)/page.tsx` | Added 5 dashboard widgets |
| `components/app/admin-sidebar.tsx` | Added Insights nav section |
| `lib/supabase/aliases.ts` | Added Phase 12 type alias (commented) |
| `messages/en.json` + `messages/id.json` | Added nav, settings, reports, dashboard widget keys |

---

## Notes for Next Agent

### Patterns established
- **Reports follow a uniform shape**: `<ReportShell>` with date range, useQuery against `/api/reports/<name>`, table + optional chart, CSV export. Reuse this pattern for any new report.
- **Charts are SVG-only**: no chart library installed. Use `<LineChart>` / `<BarChart>` from `components/reports/charts.tsx` for new visualisations. Picks up theme via `currentColor`/Tailwind classes.
- **CSV export is client-side**: server returns JSON, client uses `toCsv()` + `downloadCsv()`. This keeps API routes simple and lets each report decide how to format.
- **Activity feed pattern**: `/api/reports/activity` aggregates multiple tables into a unified `{ id, kind, at, actor, cat, summary }` shape, sorted by time. Adding a new audit source means adding another section to the route.
- **System settings as singleton**: any future global config goes in the `system_settings` row — never create new singleton tables. Add the column + bump the Zod schema + the `<SettingsClient>` form.

### Not implemented
- **Cattery name does not yet override the brand text** in `<AdminSidebar>` — it still uses the env/hardcoded brand. Wire up a layout-level fetch of `system_settings.cattery_name` if you want it to apply across the app.
- **Gestation days setting is not yet read** by Phase 9 mating records (the migration uses a hard-coded `+ 63`). To use the dynamic value, drop the generated column or recompute in the API.
- **Reminder lead days settings are not yet wired** into push notifications — they're stored but not consumed.
- **No CSV import** — only export.
- **No PDF export** — only CSV. Spec mentioned print-friendly views but they're not built (browser print should work on the simple tables).
- **No symptom tag list / breed list / medicine preset list management** UI — these were in §11.3 but deferred since they aren't blocking any current feature.

### Next phase
**Phase 13 — Finance** per spec §9. Requires `transactions`, `transaction_categories`, `payroll_records`, `salary_definitions` tables + auto-transaction triggers from vet visits / adoption / stock. Will need to wire `default_currency` from `system_settings`.
