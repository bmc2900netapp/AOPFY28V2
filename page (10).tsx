import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getSubmission, getViewerIdentity } from '@/lib/sharepoint-store';
import { SubmissionDetailClient } from './_components/submission-detail-client';

export const dynamic = 'force-dynamic';

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  let submission: any = null;
  try {
    submission = await getSubmission(id);
  } catch {
    redirect('/dashboard');
  }
  if (!submission) redirect('/dashboard');

  const isAdmin = (session?.user as any)?.role === 'admin';
  const { email } = await getViewerIdentity();
  if (!isAdmin && String(submission.submitterEmail ?? '').toLowerCase() !== email.toLowerCase()) redirect('/dashboard');

  return <SubmissionDetailClient submission={submission} isAdmin={isAdmin} />;
}
