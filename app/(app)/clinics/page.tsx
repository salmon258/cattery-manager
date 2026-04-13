import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { ClinicsClient } from '@/components/vet/clinics-client';

export default async function ClinicsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/');
  return <ClinicsClient />;
}
