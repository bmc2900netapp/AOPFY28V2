import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { TranscriptImportClient } from './_components/transcript-import-client';

export const dynamic = 'force-dynamic';

export default async function TranscriptImportPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <TranscriptImportClient />;
}
