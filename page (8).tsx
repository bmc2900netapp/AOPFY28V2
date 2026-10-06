import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { listSubmissions } from '@/lib/sharepoint-store';
import { AdminDashboardClient } from './_components/admin-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== 'admin') redirect('/dashboard');

  let data: any[] = [];
  let error: string | null = null;
  try {
    data = await listSubmissions({ all: true });
  } catch (e: any) {
    error = e?.message ?? 'Could not load submissions.';
  }

  return <AdminDashboardClient submissions={data} error={error} />;
}
