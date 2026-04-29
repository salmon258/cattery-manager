import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { MedicationNotesClient } from '@/components/medication-notes/medication-notes-client';

export default async function MedicationNotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signout');
  if (user.profile.role !== 'admin') redirect('/my-cats');
  return <MedicationNotesClient />;
}
