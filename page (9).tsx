import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { IntakeWizard } from './_components/intake-wizard';

export const dynamic = 'force-dynamic';

export default async function NewIntakePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <IntakeWizard user={{ id: session.user.id, email: session.user.email, name: session.user.name ?? '' }} />;
}
