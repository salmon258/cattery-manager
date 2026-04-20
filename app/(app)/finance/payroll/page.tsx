import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createClient } from '@/lib/supabase/server';
import { PayrollClient } from '@/components/finance/payroll-client';

export default async function FinancePayrollPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/my-payroll');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const { data: settings } = await supabase
    .from('system_settings')
    .select('default_currency')
    .eq('id', 1)
    .maybeSingle();

  return <PayrollClient defaultCurrency={settings?.default_currency ?? 'IDR'} />;
}
