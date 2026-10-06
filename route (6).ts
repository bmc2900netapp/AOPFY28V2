export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createSubmission, listSubmissions, getViewerIdentity } from '@/lib/sharepoint-store';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { email, name } = await getViewerIdentity();
    const data = await request.json();

    const payload = {
      submitterEmail: email,
      submitterName: name,
      status: 'Pending Review',
      // Phase 1
      projectTitle: data?.projectTitle ?? '',
      functionalOwner: data?.functionalOwner ?? '',
      estcMember: data?.estcMember ?? '',
      itProductOwner: data?.itProductOwner ?? '',
      functionalArea: data?.functionalArea ?? '',
      projectClassification: data?.projectClassification ?? '',
      category: data?.category ?? '',
      initiativeType: data?.initiativeType ?? '',
      projectNarrative: data?.projectNarrative ?? '',
      architectureChanges: data?.architectureChanges ?? false,
      // Phase 2
      projectStartDate: data?.projectStartDate ?? null,
      projectEndDate: data?.projectEndDate ?? null,
      baselineResources: data?.baselineResources ?? null,
      incrementalFtes: data?.incrementalFtes ?? 0,
      location: data?.location ?? null,
      jobLevel: data?.jobLevel ?? null,
      edaDependency: data?.edaDependency ?? 'None',
      edaProductManager: data?.edaProductManager ?? null,
      // Phase 3
      outsideServices: data?.outsideServices ?? 0,
      osStartDate: data?.osStartDate ?? null,
      osEndDate: data?.osEndDate ?? null,
      softwareCosts: data?.softwareCosts ?? 0,
      softwareStartDate: data?.softwareStartDate ?? null,
      softwareTerm: data?.softwareTerm ?? null,
      hardwareCost: data?.hardwareCost ?? 0,
      hardwareReceiptDate: data?.hardwareReceiptDate ?? null,
      totalFundingRequested: data?.totalFundingRequested ?? 0,
      itFunded: data?.itFunded ?? 'No',
      itFundingAmount: data?.itFundingAmount ?? null,
      bizFunded: data?.bizFunded ?? 'No',
      bizFundingAmount: data?.bizFundingAmount ?? null,
      otherComments: data?.otherComments ?? null,
      incrementalLaborCosts: data?.incrementalLaborCosts ?? 0,
      // Phase 4
      totalProjectCost: data?.totalProjectCost ?? null,
      costSavings: data?.costSavings ?? null,
      revenueIncrease: data?.revenueIncrease ?? null,
      businessValueDetails: data?.businessValueDetails ?? null,
      complianceJustification: data?.complianceJustification ?? null,
      // Governance defaults
      decision: 'Pending Review',
    };

    const id = await createSubmission(payload);
    return NextResponse.json({ id, status: 'created' });
  } catch (err: any) {
    console.error('Submission error:', err);
    return NextResponse.json({ error: err?.message ?? 'Submission failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const isAdmin = (session.user as any)?.role === 'admin';
    const { email } = await getViewerIdentity();

    const submissions = await listSubmissions({ email, all: all && isAdmin });
    return NextResponse.json(submissions);
  } catch (err: any) {
    console.error('Fetch submissions error:', err);
    return NextResponse.json({ error: err?.message ?? 'Failed to fetch' }, { status: 500 });
  }
}
