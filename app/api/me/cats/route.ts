import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('cats')
    .select('*, current_room:rooms(id, name), assignee:profiles!cats_assignee_id_fkey(id, full_name)')
    .eq('assignee_id', user.profile.id)
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cats = data ?? [];
  const catIds = cats.map((c) => c.id);

  // Today's [startIso, endIso] window used for per-cat summaries below.
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const startIso = startOfDay.toISOString();
  const endIso   = endOfDay.toISOString();

  // Fetch the latest weight recorded_at for each assigned cat so the client
  // can show a "log today's weight" reminder when no weight has been logged today.
  const [
    latestWeightsRes,
    openTicketsRes,
    todayWeightsRes,
    todayMealsRes,
    todayAdHocRes,
    todayConfirmedMedsRes
  ] = catIds.length
    ? await Promise.all([
        supabase.from('cat_latest_weight').select('cat_id, recorded_at').in('cat_id', catIds),
        supabase
          .from('health_tickets')
          .select('cat_id')
          .in('cat_id', catIds)
          .in('status', ['open', 'in_progress']),
        supabase
          .from('weight_logs')
          .select('id, cat_id, weight_kg, recorded_at')
          .in('cat_id', catIds)
          .gte('recorded_at', startIso)
          .lte('recorded_at', endIso)
          .order('recorded_at', { ascending: false }),
        supabase
          .from('eating_logs')
          .select(`
            id, cat_id, meal_time, feeding_method,
            items:eating_log_items(
              quantity_given_g, quantity_eaten, quantity_eaten_g, estimated_kcal_consumed,
              food:food_items(name)
            )
          `)
          .in('cat_id', catIds)
          .gte('meal_time', startIso)
          .lte('meal_time', endIso)
          .order('meal_time', { ascending: false }),
        supabase
          .from('ad_hoc_medicines')
          .select('id, cat_id, medicine_name, dose, unit, route, given_at')
          .in('cat_id', catIds)
          .gte('given_at', startIso)
          .lte('given_at', endIso)
          .order('given_at', { ascending: false }),
        supabase
          .from('medication_tasks')
          .select(`
            id, medication_id, due_at, confirmed_at,
            medication:medications(cat_id, medicine_name, dose)
          `)
          .gte('confirmed_at', startIso)
          .lte('confirmed_at', endIso)
          .not('confirmed_at', 'is', null)
          .order('confirmed_at', { ascending: false })
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] }
      ];

  const weightByCat = new Map(
    ((latestWeightsRes.data ?? []) as Array<{ cat_id: string | null; recorded_at: string | null }>)
      .filter((w): w is { cat_id: string; recorded_at: string } => !!w.cat_id && !!w.recorded_at)
      .map((w) => [w.cat_id, w.recorded_at])
  );

  const ticketCountByCat = new Map<string, number>();
  for (const tk of openTicketsRes.data ?? []) {
    ticketCountByCat.set(tk.cat_id, (ticketCountByCat.get(tk.cat_id) ?? 0) + 1);
  }

  // ─── Today summaries per cat ────────────────────────────────────────────
  type TodayWeight = { id: string; weight_kg: number; recorded_at: string };
  type TodayMeal = {
    id: string;
    meal_time: string;
    feeding_method: 'self' | 'assisted' | 'force_fed';
    total_grams: number;
    total_eaten_g: number;
    total_kcal: number;
    food_names: string[];
  };
  type TodayAdHoc = {
    id: string;
    medicine_name: string;
    dose: string | null;
    unit: string | null;
    route: string | null;
    given_at: string;
  };
  type TodayConfirmedMed = {
    id: string;
    medicine_name: string;
    dose: string | null;
    due_at: string;
    confirmed_at: string;
  };

  const weightsByCat = new Map<string, TodayWeight[]>();
  for (const w of (todayWeightsRes.data ?? []) as TodayWeight[] & { cat_id: string }[]) {
    const arr = weightsByCat.get((w as unknown as { cat_id: string }).cat_id) ?? [];
    arr.push({ id: w.id, weight_kg: Number(w.weight_kg), recorded_at: w.recorded_at });
    weightsByCat.set((w as unknown as { cat_id: string }).cat_id, arr);
  }

  const mealsByCat = new Map<string, TodayMeal[]>();
  for (const m of todayMealsRes.data ?? []) {
    let totalG = 0;
    let totalEatenG = 0;
    let totalK = 0;
    const foodNames: string[] = [];
    for (const it of m.items ?? []) {
      totalG += Number(it.quantity_given_g ?? 0);
      totalEatenG += Number(it.quantity_eaten_g ?? 0);
      totalK += Number(it.estimated_kcal_consumed ?? 0);
      if (it.food?.name) foodNames.push(it.food.name);
    }
    const entry: TodayMeal = {
      id: m.id,
      meal_time: m.meal_time,
      feeding_method: m.feeding_method,
      total_grams: totalG,
      total_eaten_g: totalEatenG,
      total_kcal: totalK,
      food_names: foodNames
    };
    const arr = mealsByCat.get(m.cat_id) ?? [];
    arr.push(entry);
    mealsByCat.set(m.cat_id, arr);
  }

  const adHocByCat = new Map<string, TodayAdHoc[]>();
  for (const a of todayAdHocRes.data ?? []) {
    const arr = adHocByCat.get(a.cat_id) ?? [];
    arr.push({
      id: a.id,
      medicine_name: a.medicine_name,
      dose: a.dose ?? null,
      unit: a.unit ?? null,
      route: a.route ?? null,
      given_at: a.given_at
    });
    adHocByCat.set(a.cat_id, arr);
  }

  const confirmedMedsByCat = new Map<string, TodayConfirmedMed[]>();
  for (const t of todayConfirmedMedsRes.data ?? []) {
    const catId = t.medication?.cat_id;
    if (!catId) continue;
    const arr = confirmedMedsByCat.get(catId) ?? [];
    if (!t.confirmed_at) continue;
    arr.push({
      id: t.id,
      medicine_name: t.medication?.medicine_name ?? '',
      dose: t.medication?.dose ?? null,
      due_at: t.due_at,
      confirmed_at: t.confirmed_at
    });
    confirmedMedsByCat.set(catId, arr);
  }

  const result = cats.map((c) => ({
    ...c,
    last_weight_recorded_at: weightByCat.get(c.id) ?? null,
    open_ticket_count: ticketCountByCat.get(c.id) ?? 0,
    today_summary: {
      weights: weightsByCat.get(c.id) ?? [],
      meals: mealsByCat.get(c.id) ?? [],
      ad_hoc_meds: adHocByCat.get(c.id) ?? [],
      confirmed_med_tasks: confirmedMedsByCat.get(c.id) ?? []
    }
  }));

  return NextResponse.json({ cats: result });
}
