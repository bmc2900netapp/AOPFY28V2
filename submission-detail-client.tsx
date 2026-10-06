'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PersonPicker } from '@/components/ui/person-picker';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, CheckCircle2, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { FieldMeta, FIELD_META_BY_KEY, optionsWithValue } from '@/lib/field-metadata';

function fmt(v: number | null | undefined): string {
  return '$' + (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-US'); } catch { return '—'; }
}

function toDateInput(v: any): string {
  if (!v) return '';
  try { return new Date(v).toISOString().split('T')[0]; } catch { return ''; }
}

const statusColor: Record<string, string> = {
  'Pending Review': 'bg-amber-100 text-amber-800',
  'Approved': 'bg-emerald-100 text-emerald-800',
  'Denied': 'bg-red-100 text-red-800',
  'Backlog': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-gray-100 text-gray-600',
};

// Metadata for fields not present in FIELD_META (dates/costs shown only in detail view).
const EXTRA_META: Record<string, FieldMeta> = {
  baselineResources: { key: 'baselineResources', label: 'Baseline Resources', type: 'textarea' },
  osStartDate: { key: 'osStartDate', label: 'Outside Services Start Date', type: 'date' },
  osEndDate: { key: 'osEndDate', label: 'Outside Services End Date', type: 'date' },
  softwareStartDate: { key: 'softwareStartDate', label: 'Software Start Date', type: 'date' },
  softwareTerm: { key: 'softwareTerm', label: 'Software Term (months)', type: 'number' },
  hardwareReceiptDate: { key: 'hardwareReceiptDate', label: 'Hardware Receipt Date', type: 'date' },
  totalProjectCost: { key: 'totalProjectCost', label: 'Total Project Cost (Est.) ($)', type: 'number' },
};

function metaFor(key: string): FieldMeta {
  return FIELD_META_BY_KEY[key] ?? EXTRA_META[key] ?? { key, label: key, type: 'text' };
}

// Editable content fields grouped to match the read-only phase layout.
const EDIT_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Project Identification',
    keys: ['projectTitle', 'functionalOwner', 'estcMember', 'itProductOwner', 'functionalArea', 'projectClassification', 'category', 'initiativeType', 'architectureChanges', 'projectNarrative', 'complianceJustification'],
  },
  {
    title: 'Timeline & Resources',
    keys: ['projectStartDate', 'projectEndDate', 'incrementalFtes', 'location', 'jobLevel', 'edaDependency', 'edaProductManager', 'baselineResources'],
  },
  {
    title: 'Financial Details',
    keys: ['outsideServices', 'osStartDate', 'osEndDate', 'softwareCosts', 'softwareStartDate', 'softwareTerm', 'hardwareCost', 'hardwareReceiptDate', 'totalFundingRequested', 'itFunded', 'itFundingAmount', 'bizFunded', 'bizFundingAmount', 'incrementalLaborCosts', 'otherComments'],
  },
  {
    title: 'Strategic Alignment',
    keys: ['totalProjectCost', 'costSavings', 'revenueIncrease', 'businessValueDetails'],
  },
];

const CONTENT_KEYS = EDIT_GROUPS.flatMap((g) => g.keys);

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="py-2 flex justify-between items-start border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  );
}

function EditField({ fieldKey, value, onChange }: { fieldKey: string; value: any; onChange: (v: any) => void }) {
  const meta = metaFor(fieldKey);
  const inputClass = 'w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const val = value ?? '';

  if (meta.type === 'textarea') {
    return (
      <textarea
        value={val}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
      />
    );
  }
  if (meta.type === 'person') {
    return <PersonPicker value={String(val)} onChange={onChange} placeholder="Search by name or enter email..." />;
  }
  if (meta.type === 'boolean') {
    return (
      <select value={val ? 'Yes' : 'No'} onChange={(e) => onChange(e.target.value === 'Yes')} className={inputClass}>
        <option value="No">No</option>
        <option value="Yes">Yes</option>
      </select>
    );
  }
  if (meta.type === 'select') {
    const opts = optionsWithValue(meta.options, value);
    return (
      <select value={val} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— Select —</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (meta.type === 'number') {
    return <input type="number" value={val} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  }
  if (meta.type === 'date') {
    return <input type="date" value={toDateInput(val)} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  }
  return <input type="text" value={val} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
}

export function SubmissionDetailClient({ submission, isAdmin }: { submission: any; isAdmin: boolean }) {
  const router = useRouter();
  const s = submission ?? {};

  // ---- Owner/admin content editing ----
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  function enterEdit() {
    const f: Record<string, any> = {};
    for (const k of CONTENT_KEYS) {
      const meta = metaFor(k);
      if (meta.type === 'date') f[k] = toDateInput(s[k]);
      else if (meta.type === 'boolean') f[k] = Boolean(s[k]);
      else f[k] = s[k] ?? '';
    }
    setForm(f);
    setEditing(true);
  }

  function setField(key: string, v: any) {
    setForm((p) => ({ ...p, [key]: v }));
  }

  async function saveContent() {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/submissions/${s?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error ?? 'Update failed');
      }
      toast.success('Submission updated');
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  }

  // ---- Admin governance editing ----
  const [saving, setSaving] = useState(false);
  const [adminData, setAdminData] = useState({
    decision: submission?.decision ?? 'Pending Review',
    includedInFy28Aop: submission?.includedInFy28Aop ?? false,
    priorityRank: submission?.priorityRank ?? '',
    financialValidation: submission?.financialValidation ?? false,
    estcPriorityRank: submission?.estcPriorityRank ?? '',
    snowDemandId: submission?.snowDemandId ?? '',
    snowProjectId: submission?.snowProjectId ?? '',
    oracleId: submission?.oracleId ?? '',
    adminNotes: submission?.adminNotes ?? '',
    priorityForEstimation: submission?.priorityForEstimation ?? '',
  });

  async function saveAdmin() {
    setSaving(true);
    try {
      const body = {
        ...adminData,
        priorityRank: adminData.priorityRank ? parseInt(String(adminData.priorityRank)) : null,
        estcPriorityRank: adminData.estcPriorityRank ? parseInt(String(adminData.estcPriorityRank)) : null,
      };
      const res = await fetch(`/api/submissions/${submission?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Submission updated');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={isAdmin ? '/dashboard/admin' : '/dashboard'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{s?.projectTitle ?? 'Untitled'}</h2>
          <p className="text-sm text-muted-foreground mt-1">Submitted by {s?.submitterName || s?.submitterEmail || 'Unknown'} on {fmtDate(s?.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={cn('text-xs font-medium px-3 py-1.5 rounded-full', statusColor[s?.status ?? ''] ?? 'bg-gray-100 text-gray-600')}>
            {s?.status ?? 'Unknown'}
          </span>
          {!editing && (
            <Button variant="outline" size="sm" onClick={enterEdit}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {editing ? (
          <>
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
              You are editing this submission. Changes are saved to the FY28 AOP list when you click <strong>Save Changes</strong>.
            </div>
            {EDIT_GROUPS.map((group) => (
              <div key={group.title} className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} /> {group.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.keys.map((key) => {
                    const meta = metaFor(key);
                    const fullWidth = meta.type === 'textarea';
                    return (
                      <div key={key} className={fullWidth ? 'md:col-span-2' : ''}>
                        <label className="text-sm font-medium mb-1 block">{meta.label}</label>
                        <EditField fieldKey={key} value={form[key]} onChange={(v) => setField(key, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={savingEdit}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={saveContent} loading={savingEdit}>
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Phase 1 */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} /> Project Identification</h3>
              <InfoRow label="IT Functional Owner" value={s?.functionalOwner} />
              <InfoRow label="ESTC Member" value={s?.estcMember} />
              <InfoRow label="IT Product Owner" value={s?.itProductOwner} />
              <InfoRow label="Functional Area" value={s?.functionalArea} />
              <InfoRow label="Classification" value={s?.projectClassification} />
              <InfoRow label="Category" value={s?.category} />
              <InfoRow label="Initiative Type" value={s?.initiativeType} />
              <InfoRow label="Architecture Changes" value={s?.architectureChanges ? 'Yes' : 'No'} />
              <div className="mt-3">
                <p className="text-sm text-muted-foreground mb-1">Project Narrative</p>
                <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{s?.projectNarrative ?? '—'}</p>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} /> Timeline & Resources</h3>
              <InfoRow label="Project Start Date" value={fmtDate(s?.projectStartDate)} />
              <InfoRow label="Project End Date" value={fmtDate(s?.projectEndDate)} />
              <InfoRow label="Incremental FTEs" value={s?.incrementalFtes} />
              {(s?.incrementalFtes ?? 0) > 0 && (
                <>
                  <InfoRow label="Location" value={s?.location} />
                  <InfoRow label="Job Level" value={s?.jobLevel} />
                </>
              )}
              <InfoRow label="EDA Dependency" value={s?.edaDependency} />
              {s?.edaDependency !== 'None' && <InfoRow label="EDA Product Manager" value={s?.edaProductManager} />}
              {s?.baselineResources && <InfoRow label="Baseline Resources" value={s?.baselineResources} />}
            </div>

            {/* Phase 3 */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} /> Financial Details</h3>
              <InfoRow label="Outside Services" value={fmt(s?.outsideServices)} />
              {(s?.outsideServices ?? 0) > 0 && (
                <>
                  <InfoRow label="OS Start Date" value={fmtDate(s?.osStartDate)} />
                  <InfoRow label="OS End Date" value={fmtDate(s?.osEndDate)} />
                </>
              )}
              <InfoRow label="Software Costs" value={fmt(s?.softwareCosts)} />
              {(s?.softwareCosts ?? 0) > 0 && (
                <>
                  <InfoRow label="Software Start Date" value={fmtDate(s?.softwareStartDate)} />
                  <InfoRow label="Software Term" value={s?.softwareTerm ? `${s.softwareTerm} months` : '—'} />
                </>
              )}
              <InfoRow label="Hardware Cost (CapEx)" value={fmt(s?.hardwareCost)} />
              {(s?.hardwareCost ?? 0) > 0 && <InfoRow label="Hardware Receipt Date" value={fmtDate(s?.hardwareReceiptDate)} />}
              <div className="rounded-lg p-3 my-2" style={{ background: 'rgba(0,248,197,0.08)', border: '1px solid var(--accent-teal)' }}>
                <InfoRow label="Total Funding Requested" value={<span className="text-lg font-bold" style={{ color: 'var(--accent-teal-muted)' }}>{fmt(s?.totalFundingRequested)}</span>} />
              </div>
              <InfoRow label="IT Funded" value={s?.itFunded} />
              {s?.itFundingAmount != null && <InfoRow label="IT Funding Amount" value={fmt(s?.itFundingAmount)} />}
              <InfoRow label="Biz Funded" value={s?.bizFunded} />
              {s?.bizFundingAmount != null && <InfoRow label="Biz Funding Amount" value={fmt(s?.bizFundingAmount)} />}
              <InfoRow label="Incremental Labor Costs" value={fmt(s?.incrementalLaborCosts)} />
              {s?.otherComments && <InfoRow label="Other Comments" value={s?.otherComments} />}
            </div>

            {/* Phase 4 */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} /> Strategic Alignment</h3>
              <InfoRow label="Total Project Cost (Est.)" value={s?.totalProjectCost ? fmt(s.totalProjectCost) : 'Not provided'} />
              <InfoRow label="Cost Savings (Est.)" value={s?.costSavings ? fmt(s.costSavings) : 'Not provided'} />
              <InfoRow label="Revenue Increase (Est.)" value={s?.revenueIncrease ? fmt(s.revenueIncrease) : 'Not provided'} />
              {s?.businessValueDetails && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-1">Business Value Details</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{s.businessValueDetails}</p>
                </div>
              )}
              {s?.complianceJustification && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-1">Compliance/Regulatory Justification</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{s.complianceJustification}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Admin fields */}
        {isAdmin && (
          <div className="bg-card rounded-xl border-2 p-5" style={{ borderColor: 'var(--accent-teal)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--accent-teal-muted)' }}>Admin / Governance (Phase 5)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Decision</label>
                <select
                  value={adminData.decision}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdminData((p: any) => ({ ...p, decision: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  {['Pending Review', 'Approved', 'Denied', 'Backlog', 'Cancelled'].map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority for Estimation</label>
                <select
                  value={adminData.priorityForEstimation}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdminData((p: any) => ({ ...p, priorityForEstimation: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="">Not set</option>
                  {['1st Wave', '2nd Wave', '3rd Wave'].map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Included in FY28 AOP</label>
                <select
                  value={adminData.includedInFy28Aop ? 'Yes' : 'No'}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdminData((p: any) => ({ ...p, includedInFy28Aop: e.target.value === 'Yes' }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Financial Validation Complete</label>
                <select
                  value={adminData.financialValidation ? 'Yes' : 'No'}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdminData((p: any) => ({ ...p, financialValidation: e.target.value === 'Yes' }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Priority Rank</label>
                <input
                  type="number"
                  value={adminData.priorityRank}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminData((p: any) => ({ ...p, priorityRank: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  placeholder="e.g., 1"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ESTC Priority Rank</label>
                <input
                  type="number"
                  value={adminData.estcPriorityRank}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminData((p: any) => ({ ...p, estcPriorityRank: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  placeholder="Assigned by ESTC"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">SNOW Demand ID</label>
                <input
                  type="text"
                  value={adminData.snowDemandId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminData((p: any) => ({ ...p, snowDemandId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">SNOW Project ID</label>
                <input
                  type="text"
                  value={adminData.snowProjectId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminData((p: any) => ({ ...p, snowProjectId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Oracle ID</label>
                <input
                  type="text"
                  value={adminData.oracleId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdminData((p: any) => ({ ...p, oracleId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium mb-1 block">Admin Notes</label>
              <textarea
                value={adminData.adminNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdminData((p: any) => ({ ...p, adminNotes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveAdmin} loading={saving}>
                <Save className="w-4 h-4 mr-2" /> Save Admin Fields
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
