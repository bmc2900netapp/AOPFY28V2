export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listSubmissions } from '@/lib/sharepoint-store';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const submissions = await listSubmissions({ all: true });

    const headers = [
      'ID', 'Project Title', 'Submitter', 'Functional Area', 'Category',
      'Classification', 'Initiative Type', 'Status', 'Decision',
      'Outside Services', 'Software Costs', 'Hardware Cost', 'Total Funding Requested',
      'IT Funded', 'IT Funding Amount', 'Biz Funded', 'Biz Funding Amount',
      'Incremental FTEs', 'Location', 'Job Level', 'Incremental Labor Costs',
      'Start Date', 'End Date', 'Submitted Date',
    ];

    const rows = (submissions ?? []).map((s: any) => [
      s?.id ?? '', s?.projectTitle ?? '', s?.submitterEmail ?? '',
      s?.functionalArea ?? '', s?.category ?? '', s?.projectClassification ?? '',
      s?.initiativeType ?? '', s?.status ?? '', s?.decision ?? '',
      s?.outsideServices ?? 0, s?.softwareCosts ?? 0, s?.hardwareCost ?? 0,
      s?.totalFundingRequested ?? 0,
      s?.itFunded ?? '', s?.itFundingAmount ?? '', s?.bizFunded ?? '', s?.bizFundingAmount ?? '',
      s?.incrementalFtes ?? 0, s?.location ?? '', s?.jobLevel ?? '', s?.incrementalLaborCosts ?? 0,
      s?.projectStartDate?.split?.('T')?.[0] ?? '',
      s?.projectEndDate?.split?.('T')?.[0] ?? '',
      s?.createdAt?.split?.('T')?.[0] ?? '',
    ]);

    const csv = [headers.join(','), ...rows.map((r: any[]) => r.map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="fy28_aop_submissions_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Export failed' }, { status: 500 });
  }
}
