export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSubmission, updateSubmission, getViewerIdentity, FIELD_TO_COLUMN } from '@/lib/sharepoint-store';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const submission = await getSubmission(id);
    if (!submission) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const isAdmin = (session.user as any)?.role === 'admin';
    const { email } = await getViewerIdentity();
    if (!isAdmin && String(submission.submitterEmail ?? '').toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(submission);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isAdmin = (session.user as any)?.role === 'admin';
    const { id } = await params;

    // Ownership check — owner (submitter) or admin may edit.
    const existing = await getSubmission(id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { email } = await getViewerIdentity();
    const isOwner = String(existing.submitterEmail ?? '').toLowerCase() === email.toLowerCase();
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const allowed: Record<string, any> = {};

    // Admin/governance fields — admin only.
    const adminFields = ['decision', 'status', 'includedInFy28Aop', 'priorityRank', 'financialValidation', 'estcPriorityRank', 'snowDemandId', 'snowProjectId', 'oracleId', 'adminNotes', 'priorityForEstimation'];
    const adminSet = new Set(adminFields);
    // Never editable through this route (identity/system columns).
    const immutable = new Set(['submitterEmail', 'submitterName']);

    // Content fields — editable by owner or admin.
    for (const key of Object.keys(FIELD_TO_COLUMN)) {
      if (adminSet.has(key) || immutable.has(key)) continue;
      if (data?.[key] !== undefined) {
        allowed[key] = data[key];
      }
    }

    // Admin-only fields.
    if (isAdmin) {
      for (const key of adminFields) {
        if (data?.[key] !== undefined) {
          allowed[key] = data[key];
        }
      }
      // Sync status with decision
      if (allowed.decision) {
        allowed.status = allowed.decision;
      }
    }

    await updateSubmission(id, allowed);
    return NextResponse.json({ id, status: allowed.status ?? 'updated' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Update failed' }, { status: 500 });
  }
}
