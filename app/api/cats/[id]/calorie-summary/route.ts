import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/current-user';

/**
 * GET /api/cats/[id]/calorie-summary
 * Returns:
 *   - recommended_kcal      (null if no weight logged yet)
 *   - today_kcal            (sum of estimated_kcal_consumed for meals today, local time)
 *   - last7_days            [{ date: 'YYYY-MM-DD', kcal: number }] (oldest → newest)
 *   - latest_weight_kg
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = createClient();

  // Recommended kcal via DB helper (returns numeric or null if no weight).
  const { data: recRaw } = await supabase.rpc('recommended_daily_kcal', { p_cat_id: params.id });
  const recommended_kcal = recRaw === null || recRaw === undefined ? null : Number(recRaw);

  // Active life stage + the multiplier it resolves to (used for the stage
  // badge on the detail page).
  const { data: stageRaw } = await supabase.rpc('cat_life_stage', { p_cat_id: params.id });
  const { data: mulRaw } = await supabase.rpc('cat_derived_life_stage_multiplier', { p_cat_id: params.id });
  const life_stage = (stageRaw ?? null) as
    | 'kitten_young' | 'lactating' | 'pregnant' | 'kitten' | 'spayed' | 'adult' | null;
  const life_stage_multiplier = mulRaw === null || mulRaw === undefined ? null : Number(mulRaw);

  // Latest weight (for display).
  const { data: latest } = await supabase
    .from('cat_latest_weight')
    .select('weight_kg, recorded_at')
    .eq('cat_id', params.id)
    .maybeSingle();

  // Pull the last 8 days of meals (covers rolling 7-day window + today).
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);

  const { data: sessions } = await supabase
    .from('eating_logs')
    .select('id, meal_time, items:eating_log_items(estimated_kcal_consumed)')
    .eq('cat_id', params.id)
    .gte('meal_time', since.toISOString())
    .order('meal_time', { ascending: true });

  // Build day buckets (local server time; fine for single-cattery usage).
  const dayBuckets = new Map<string, number>();
  const todayKey = fmtDay(new Date());
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayBuckets.set(fmtDay(d), 0);
  }

  for (const s of sessions ?? []) {
    const key = fmtDay(new Date(s.meal_time));
    if (!dayBuckets.has(key)) continue;
    const kcal = (s.items ?? []).reduce(
      (acc: number, it: { estimated_kcal_consumed: number | null }) =>
        acc + (Number(it.estimated_kcal_consumed) || 0),
      0
    );
    dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + kcal);
  }

  const last7_days = Array.from(dayBuckets.entries()).map(([date, kcal]) => ({
    date,
    kcal: Math.round(kcal)
  }));
  const today_kcal = Math.round(dayBuckets.get(todayKey) ?? 0);

  return NextResponse.json({
    recommended_kcal,
    today_kcal,
    last7_days,
    latest_weight_kg: latest?.weight_kg ?? null,
    latest_weight_at: latest?.recorded_at ?? null,
    life_stage,
    life_stage_multiplier
  });
}

function fmtDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
