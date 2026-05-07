import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/dashboard/daily-progress
 * Admin only. Today's care progress for every active cat, grouped by primary
 * sitter. Cats without an assignee end up in the "unassigned" group.
 *
 * Per cat we return (all limited to today's window unless stated):
 *   - latest_weight:     { weight_kg, recorded_at } | null   (today's reading if any)
 *   - previous_weight:   { weight_kg, recorded_at } | null   (most recent reading
 *                        strictly BEFORE today, within the last 30 days — used
 *                        by the dashboard to show a day-over-day delta)
 *   - meals:             [{ id, meal_time, feeding_method, total_grams, total_eaten_g, total_kcal, worst_ratio, food_names,
 *                          items: [{ name, food_type, grams, eaten_g, kcal, ratio }] }]
 *   - med_tasks:         [{ id, due_at, confirmed_at, skipped, overdue, medicine_name }]
 *   - open_tickets:      count of open/in_progress tickets
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  if (user.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createClient();

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const startIso = startOfDay.toISOString();
  const endIso   = endOfDay.toISOString();
  const nowIso   = new Date().toISOString();
  // Lookback for the "previous" comparison weight. 30 days is more than
  // enough to catch the most recent prior reading for any active cat while
  // keeping the row count on this query bounded.
  const previousLookback = new Date(startOfDay);
  previousLookback.setDate(previousLookback.getDate() - 30);
  const previousStartIso = previousLookback.toISOString();

  const [
    catsRes,
    sittersRes,
    weightsRes,
    previousWeightsRes,
    mealsRes,
    medsRes,
    ticketsRes
  ] = await Promise.all([
    supabase
      .from('cats')
      .select('id, name, profile_photo_url, gender, status, assignee_id')
      .eq('status', 'active')
      .order('name', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'cat_sitter')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabase
      .from('weight_logs')
      .select('cat_id, weight_kg, recorded_at')
      .gte('recorded_at', startIso)
      .lte('recorded_at', endIso)
      .order('recorded_at', { ascending: false }),
    supabase
      .from('weight_logs')
      .select('cat_id, weight_kg, recorded_at')
      .gte('recorded_at', previousStartIso)
      .lt('recorded_at', startIso)
      .order('recorded_at', { ascending: false }),
    supabase
      .from('eating_logs')
      .select(`
        id, cat_id, meal_time, feeding_method,
        items:eating_log_items(
          quantity_given_g, quantity_eaten, quantity_eaten_g, estimated_kcal_consumed,
          food:food_items(name, type)
        )
      `)
      .gte('meal_time', startIso)
      .lte('meal_time', endIso)
      .order('meal_time', { ascending: true }),
    supabase
      .from('medication_tasks')
      .select(`
        id, medication_id, due_at, confirmed_at, skipped,
        medication:medications(cat_id, medicine_name)
      `)
      .gte('due_at', startIso)
      .lte('due_at', endIso)
      .order('due_at', { ascending: true }),
    supabase
      .from('health_tickets')
      .select('cat_id')
      .in('status', ['open', 'in_progress'])
  ]);

  if (catsRes.error)    return NextResponse.json({ error: catsRes.error.message },    { status: 500 });
  if (sittersRes.error) return NextResponse.json({ error: sittersRes.error.message }, { status: 500 });

  // ─── Latest weight per cat (first row wins because we sorted desc) ───────
  type WeightVal = { weight_kg: number; recorded_at: string };
  const latestWeight = new Map<string, WeightVal>();
  for (const w of weightsRes.data ?? []) {
    if (!latestWeight.has(w.cat_id)) {
      latestWeight.set(w.cat_id, { weight_kg: Number(w.weight_kg), recorded_at: w.recorded_at });
    }
  }

  // ─── Previous weight per cat (most recent reading BEFORE today) ──────────
  const previousWeight = new Map<string, WeightVal>();
  for (const w of previousWeightsRes.data ?? []) {
    if (!previousWeight.has(w.cat_id)) {
      previousWeight.set(w.cat_id, { weight_kg: Number(w.weight_kg), recorded_at: w.recorded_at });
    }
  }

  // ─── Meals per cat: summarise each session with the worst eaten ratio ──
  type EatenRatio = 'all' | 'most' | 'half' | 'little' | 'none';
  type FoodType = 'wet' | 'dry' | 'raw' | 'treat' | 'supplement' | 'other';
  type MealItem = {
    name: string;
    food_type: FoodType;
    grams: number;
    eaten_g: number;
    kcal: number;
    ratio: EatenRatio;
  };
  type MealSummary = {
    id: string;
    meal_time: string;
    feeding_method: 'self' | 'assisted' | 'force_fed';
    total_grams: number;
    total_eaten_g: number;
    total_kcal: number;
    worst_ratio: EatenRatio;
    food_names: string[];
    items: MealItem[];
  };

  const RATIO_RANK: Record<EatenRatio, number> = {
    all: 4, most: 3, half: 2, little: 1, none: 0
  };

  const mealsByCat = new Map<string, MealSummary[]>();
  for (const m of mealsRes.data ?? []) {
    let totalG = 0;
    let totalEaten = 0;
    let totalK = 0;
    let worst: EatenRatio = 'all';
    const foodNames: string[] = [];
    const items: MealItem[] = [];
    for (const it of m.items ?? []) {
      const grams = Number(it.quantity_given_g ?? 0);
      const eaten = Number(it.quantity_eaten_g ?? 0);
      const kcal = Number(it.estimated_kcal_consumed ?? 0);
      const r = (it.quantity_eaten as EatenRatio) ?? 'all';
      totalG += grams;
      totalEaten += eaten;
      totalK += kcal;
      if (RATIO_RANK[r] < RATIO_RANK[worst]) worst = r;
      const name = it.food?.name ?? '';
      const type = (it.food?.type as FoodType | undefined) ?? 'other';
      if (name) foodNames.push(name);
      items.push({ name, food_type: type, grams, eaten_g: eaten, kcal, ratio: r });
    }
    const summary: MealSummary = {
      id: m.id,
      meal_time: m.meal_time,
      feeding_method: m.feeding_method,
      total_grams: totalG,
      total_eaten_g: totalEaten,
      total_kcal: totalK,
      worst_ratio: worst,
      food_names: foodNames,
      items
    };
    if (!mealsByCat.has(m.cat_id)) mealsByCat.set(m.cat_id, []);
    mealsByCat.get(m.cat_id)!.push(summary);
  }

  // ─── Medication tasks per cat ─────────────────────────────────────────────
  type MedTask = {
    id: string;
    due_at: string;
    confirmed_at: string | null;
    skipped: boolean;
    overdue: boolean;
    medicine_name: string;
  };
  const medTasksByCat = new Map<string, MedTask[]>();
  for (const t of medsRes.data ?? []) {
    const catId = t.medication?.cat_id;
    if (!catId) continue;
    const task: MedTask = {
      id: t.id,
      due_at: t.due_at,
      confirmed_at: t.confirmed_at,
      skipped: t.skipped,
      overdue: !t.confirmed_at && !t.skipped && t.due_at < nowIso,
      medicine_name: t.medication?.medicine_name ?? ''
    };
    if (!medTasksByCat.has(catId)) medTasksByCat.set(catId, []);
    medTasksByCat.get(catId)!.push(task);
  }

  const ticketsByCat = new Map<string, number>();
  for (const tk of ticketsRes.data ?? []) {
    if (!tk.cat_id) continue;
    ticketsByCat.set(tk.cat_id, (ticketsByCat.get(tk.cat_id) ?? 0) + 1);
  }

  // ─── Assemble per-cat rows ────────────────────────────────────────────────
  type CatRow = NonNullable<typeof catsRes.data>[number];
  function buildRow(c: CatRow) {
    return {
      id: c.id,
      name: c.name,
      profile_photo_url: c.profile_photo_url,
      gender: c.gender,
      latest_weight:   latestWeight.get(c.id)   ?? null,
      previous_weight: previousWeight.get(c.id) ?? null,
      meals:         mealsByCat.get(c.id)    ?? [],
      med_tasks:     medTasksByCat.get(c.id) ?? [],
      open_tickets:  ticketsByCat.get(c.id)  ?? 0
    };
  }

  const sitters = sittersRes.data ?? [];
  const sitterGroups = sitters.map((s) => ({
    id:        s.id,
    full_name: s.full_name,
    cats: (catsRes.data ?? []).filter((c) => c.assignee_id === s.id).map(buildRow)
  }));

  const unassigned = (catsRes.data ?? [])
    .filter((c) => !c.assignee_id)
    .map(buildRow);

  return NextResponse.json({
    date: startOfDay.toISOString().slice(0, 10),
    sitters: sitterGroups,
    unassigned
  });
}
