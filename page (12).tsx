import { auth } from '@/auth';
import { listSubmissions, getViewerIdentity } from '@/lib/sharepoint-store';
import { MySubmissionsClient } from './_components/my-submissions-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();

  let data: any[] = [];
  let error: string | null = null;
  try {
    const { email } = await getViewerIdentity();
    const isAdmin = (session?.user as any)?.role === 'admin';
    data = await listSubmissions({ email, all: isAdmin });
  } catch (e: any) {
    error = e?.message ?? 'Could not load submissions.';
  }

  return <MySubmissionsClient submissions={data} error={error} />;
}
