'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ClipboardList, Calendar, DollarSign, Target, CheckCircle2,
  ChevronRight, ChevronLeft, AlertCircle, Info, Send, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersonPicker } from '@/components/ui/person-picker';
import { BUSINESS_AREAS, businessAreaById, isKnownPerson } from '@/lib/org-directory';

const PHASES = [
  { id: 1, label: 'Identification', icon: ClipboardList },
  { id: 2, label: 'Timeline & Resources', icon: Calendar },
  { id: 3, label: 'Financial Details', icon: DollarSign },
  { id: 4, label: 'Strategic Alignment', icon: Target },
  { id: 5, label: 'Review & Submit', icon: CheckCircle2 },
];

const FUNCTIONAL_AREAS = [
  'Infrastructure', 'Finance', 'Human Resources', 'Legal', 'Corporate Development',
  'Sales', 'Marketing', 'Engineering', 'Customer Support',
  'Operations - Quality and Reliability', 'GTM Revenue Operations', 'Cloud Operations',
  'Supply Chain', 'Security', 'Data & Analytics', 'Corporate IT', 'EDA', 'Other'
];

const CATEGORIES = [
  'Discretionary: Carry Over', 'Discretionary: Nice to Have', 'ESTC Prioritized',
  'KBR & KTLO: Must Do', 'Top Strategic', 'AI Investment'
];

const EDA_OPTIONS = ['None', 'GTM', 'CSO', 'MDM', 'Finance', 'Enterprise', 'HR', 'Operations'];
const LOCATIONS = ['US', 'India', 'Bangalore', 'Pune', 'Other'];
const JOB_LEVELS = ['Staff', 'Senior', 'Principal', 'Senior Principal', 'Distinguished', 'Contractor'];

interface FormData {
  // Phase 1
  projectTitle: string;
  functionalOwner: string;
  estcMember: string;
  itProductOwner: string;
  functionalArea: string;
  projectClassification: string;
  category: string;
  initiativeType: string;
  projectNarrative: string;
  architectureChanges: string;
  // Phase 2
  projectStartDate: string;
  projectEndDate: string;
  baselineResources: string;
  incrementalFtes: string;
  location: string;
  jobLevel: string;
  edaDependency: string;
  edaProductManager: string;
  // Phase 3
  outsideServices: string;
  osStartDate: string;
  osEndDate: string;
  softwareCosts: string;
  softwareStartDate: string;
  softwareTerm: string;
  hardwareCost: string;
  hardwareReceiptDate: string;
  itFunded: string;
  itFundingAmount: string;
  bizFunded: string;
  bizFundingAmount: string;
  otherComments: string;
  incrementalLaborCosts: string;
  // Phase 4
  totalProjectCost: string;
  costSavings: string;
  revenueIncrease: string;
  businessValueDetails: string;
  complianceJustification: string;
}

const initialForm: FormData = {
  projectTitle: '', functionalOwner: '', estcMember: '', itProductOwner: '',
  functionalArea: '', projectClassification: '', category: '', initiativeType: '',
  projectNarrative: '', architectureChanges: 'No',
  projectStartDate: '', projectEndDate: '', baselineResources: '',
  incrementalFtes: '0', location: '', jobLevel: '', edaDependency: 'None', edaProductManager: '',
  outsideServices: '0', osStartDate: '', osEndDate: '', softwareCosts: '0',
  softwareStartDate: '', softwareTerm: '', hardwareCost: '0', hardwareReceiptDate: '',
  itFunded: 'No', itFundingAmount: '', bizFunded: 'No', bizFundingAmount: '',
  otherComments: '', incrementalLaborCosts: '0',
  totalProjectCost: '', costSavings: '', revenueIncrease: '',
  businessValueDetails: '', complianceJustification: '',
};

function parseNum(v: string | undefined | null): number {
  const n = parseFloat(String(v ?? '0').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function fmtCurrency(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function hasDollarAmount(text: string): boolean {
  return /\$|\d{1,3}(,\d{3})+/.test(text ?? '');
}

// A person field is valid if it is a proper email OR a known directory name.
function isValidPerson(v: string): boolean {
  const t = (v ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || isKnownPerson(t);
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

export function IntakeWizard({ user }: { user: UserInfo }) {
  const router = useRouter();
  const [phase, setPhase] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [businessAreaId, setBusinessAreaId] = useState('');

  const selectedBA = useMemo(() => businessAreaById(businessAreaId), [businessAreaId]);

  // Pick a Business Area -> auto-fill ESTC Member (ESTC Rep) and IT Functional
  // Owner (CIO Staff Engagement Point) from the FY28 AOP directory.
  function applyBusinessArea(id: string) {
    setBusinessAreaId(id);
    const ba = businessAreaById(id);
    if (!ba) return;
    setForm((prev: FormData) => ({
      ...prev,
      estcMember: ba.estcRepEmail || ba.estcRep,
      functionalOwner: ba.cioStaffEmail || ba.cioStaff,
    }));
    setErrors((prev: Record<string, string>) => {
      const next = { ...prev };
      delete next.estcMember;
      delete next.functionalOwner;
      return next;
    });
  }

  const set = useCallback((field: keyof FormData, value: string) => {
    setForm((prev: FormData) => ({ ...prev, [field]: value }));
    setErrors((prev: Record<string, string>) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // P4 — Auto-calculated
  const totalFundingRequested = useMemo(() =>
    parseNum(form.outsideServices) + parseNum(form.softwareCosts) + parseNum(form.hardwareCost),
  [form.outsideServices, form.softwareCosts, form.hardwareCost]);

  // Funding reconciliation
  const fundingTotal = useMemo(() =>
    parseNum(form.itFundingAmount) + parseNum(form.bizFundingAmount),
  [form.itFundingAmount, form.bizFundingAmount]);

  const fundingMismatch = useMemo(() => {
    const showIT = form.itFunded === 'Yes' || form.itFunded === 'Both';
    const showBiz = form.bizFunded === 'Yes' || form.itFunded === 'Both';
    if (!showIT && !showBiz) return false;
    if (totalFundingRequested === 0) return false;
    return fundingTotal > 0 && Math.abs(fundingTotal - totalFundingRequested) > 0.01;
  }, [form.itFunded, form.bizFunded, fundingTotal, totalFundingRequested]);

  // Conditional visibility
  const showFtes = parseNum(form.incrementalFtes) > 0;
  const showOS = parseNum(form.outsideServices) > 0;
  const showSW = parseNum(form.softwareCosts) > 0;
  const showHW = parseNum(form.hardwareCost) > 0;
  const showITAmount = form.itFunded === 'Yes' || form.itFunded === 'Both';
  const showBiz = form.itFunded !== 'Both'; // If Both, auto-set biz
  const showBizAmount = form.bizFunded === 'Yes' || form.itFunded === 'Both';
  const showEDA = form.edaDependency !== 'None';
  const showCompliance = form.projectClassification === 'Non-Discretionary';
  const commentWarning = hasDollarAmount(form.otherComments);

  // Auto-set Biz Funded when IT Funded = Both
  React.useEffect(() => {
    if (form.itFunded === 'Both') {
      setForm((prev: FormData) => ({ ...prev, bizFunded: 'Yes' }));
    }
  }, [form.itFunded]);

  // Validation per phase
  function validatePhase(p: number): boolean {
    const errs: Record<string, string> = {};
    if (p === 1) {
      if (!form.projectTitle.trim()) errs.projectTitle = 'Project Title is required';
      if (!form.functionalOwner.trim()) errs.functionalOwner = 'IT Functional Owner is required';
      else if (!isValidPerson(form.functionalOwner)) errs.functionalOwner = 'Enter a valid email or select a directory name';
      if (!form.estcMember.trim()) errs.estcMember = 'ESTC Member is required';
      else if (!isValidPerson(form.estcMember)) errs.estcMember = 'Enter a valid email or select a directory name';
      if (!form.itProductOwner.trim()) errs.itProductOwner = 'IT Product Owner is required';
      else if (!isValidPerson(form.itProductOwner)) errs.itProductOwner = 'Enter a valid email or select a directory name';
      if (!form.functionalArea) errs.functionalArea = 'Functional Area is required';
      if (!form.projectClassification) errs.projectClassification = 'Project Classification is required';
      if (!form.category) errs.category = 'Category is required';
      if (!form.initiativeType) errs.initiativeType = 'Initiative Type is required';
      if (!form.projectNarrative.trim()) errs.projectNarrative = 'Project Narrative is required';
    }
    if (p === 2) {
      if (!form.projectStartDate) errs.projectStartDate = 'Project Start Date is required';
      if (!form.projectEndDate) errs.projectEndDate = 'Project End Date is required';
      if (form.projectStartDate && form.projectEndDate && form.projectEndDate <= form.projectStartDate) {
        errs.projectEndDate = 'End Date must be after Start Date';
      }
      if (showFtes && !form.location) errs.location = 'Location is required when FTEs > 0';
      if (showFtes && !form.jobLevel) errs.jobLevel = 'Job Level is required when FTEs > 0';
      if (showEDA && !form.edaProductManager.trim()) errs.edaProductManager = 'EDA Product Manager is required';
      else if (showEDA && form.edaProductManager.trim() && !isValidPerson(form.edaProductManager)) errs.edaProductManager = 'Enter a valid email or select a directory name';
    }
    if (p === 3) {
      if (showOS && !form.osStartDate) errs.osStartDate = 'Start Date required when Outside Services > $0';
      if (showOS && !form.osEndDate) errs.osEndDate = 'End Date required when Outside Services > $0';
      if (showSW && !form.softwareStartDate) errs.softwareStartDate = 'Start Date required when Software Costs > $0';
      if (showSW && !form.softwareTerm) errs.softwareTerm = 'Software Term required when Software Costs > $0';
      if (showHW && !form.hardwareReceiptDate) errs.hardwareReceiptDate = 'Receipt Date required when Hardware Cost > $0';
      if (showITAmount && !form.itFundingAmount) errs.itFundingAmount = 'IT Funding Amount is required';
      if (showBizAmount && !form.bizFundingAmount) errs.bizFundingAmount = 'Biz Funding Amount is required';
      if (commentWarning) errs.otherComments = 'Dollar amounts detected — move financial values to the appropriate cost fields above';
    }
    if (p === 4) {
      if (showCompliance && !form.complianceJustification.trim()) {
        errs.complianceJustification = 'Compliance/Regulatory Justification is required for Non-Discretionary projects';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (validatePhase(phase)) {
      setPhase((p: number) => Math.min(p + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goBack() {
    setPhase((p: number) => Math.max(p - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    if (!validatePhase(4)) { setPhase(4); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        outsideServices: parseNum(form.outsideServices),
        softwareCosts: parseNum(form.softwareCosts),
        hardwareCost: parseNum(form.hardwareCost),
        totalFundingRequested,
        itFundingAmount: showITAmount ? parseNum(form.itFundingAmount) : null,
        bizFundingAmount: showBizAmount ? parseNum(form.bizFundingAmount) : null,
        incrementalLaborCosts: parseNum(form.incrementalLaborCosts),
        incrementalFtes: parseInt(form.incrementalFtes) || 0,
        architectureChanges: form.architectureChanges === 'Yes',
        totalProjectCost: form.totalProjectCost ? parseNum(form.totalProjectCost) : null,
        costSavings: form.costSavings ? parseNum(form.costSavings) : null,
        revenueIncrease: form.revenueIncrease ? parseNum(form.revenueIncrease) : null,
        softwareTerm: form.softwareTerm ? parseInt(form.softwareTerm) : null,
      };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Submission failed');
      }
      toast.success('Initiative submitted successfully!');
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  // Helper components
  function Field({ label, field, type = 'text', required = false, placeholder = '', hint, rows, options, disabled, readOnly, prefix, className: fieldClassName }: {
    label: string; field: keyof FormData; type?: string; required?: boolean; placeholder?: string;
    hint?: string; rows?: number; options?: string[]; disabled?: boolean; readOnly?: boolean; prefix?: string; className?: string;
  }) {
    const err = errors[field];
    if (type === 'select' && options) {
      return (
        <div className={fieldClassName}>
          <label className="text-sm font-medium mb-1.5 block">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
          {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
          <select
            value={(form as any)[field] ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set(field, e.target.value)}
            className={cn('w-full h-10 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring', err && 'border-destructive')}
            disabled={disabled}
          >
            <option value="">Select...</option>
            {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>
          {err && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
        </div>
      );
    }
    if (type === 'radio' && options) {
      return (
        <div className={fieldClassName}>
          <label className="text-sm font-medium mb-1.5 block">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
          {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
          <div className="flex gap-4">
            {options.map((o: string) => (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name={field}
                  value={o}
                  checked={(form as any)[field] === o}
                  onChange={() => set(field, o)}
                  className="accent-primary"
                />
                {o}
              </label>
            ))}
          </div>
          {err && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
        </div>
      );
    }
    if (type === 'person') {
      return (
        <div className={fieldClassName}>
          <label className="text-sm font-medium mb-1.5 block">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
          {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
          <PersonPicker
            value={(form as any)[field] ?? ''}
            onChange={(v) => set(field, v)}
            placeholder={placeholder}
            disabled={disabled}
            error={!!err}
          />
          {err && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
        </div>
      );
    }
    if (rows) {
      return (
        <div className={fieldClassName}>
          <label className="text-sm font-medium mb-1.5 block">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
          {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
          <textarea
            value={(form as any)[field] ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set(field, e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className={cn('w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y', err && 'border-destructive')}
            readOnly={readOnly}
          />
          {err && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
        </div>
      );
    }
    return (
      <div className={fieldClassName}>
        <label className="text-sm font-medium mb-1.5 block">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
        <div className="relative">
          {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
          <input
            type={type}
            value={(form as any)[field] ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(field, e.target.value)}
            placeholder={placeholder}
            className={cn('w-full h-10 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring', prefix && 'pl-7', err && 'border-destructive', readOnly && 'bg-muted cursor-not-allowed')}
            readOnly={readOnly}
            disabled={disabled}
          />
        </div>
        {err && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{err}</p>}
      </div>
    );
  }

  // Phase content
  function renderPhase() {
    switch (phase) {
      case 1: return (
        <div className="space-y-5">
          <div className="rounded-lg p-4" style={{ background: 'rgba(0,248,197,0.06)', border: '1px solid rgba(0,248,197,0.25)' }}>
            <label className="text-sm font-medium mb-1 block">Business Area <span className="text-muted-foreground font-normal">(optional — auto-fills owners)</span></label>
            <p className="text-xs text-muted-foreground mb-2">Pick the business area this initiative serves to pre-fill the ESTC Member and IT Functional Owner from the FY28 AOP directory.</p>
            <select
              value={businessAreaId}
              onChange={(e) => applyBusinessArea(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a business area...</option>
              {BUSINESS_AREAS.map((b) => (
                <option key={b.id} value={b.id}>{b.area} — {b.estcRep}</option>
              ))}
            </select>
            {selectedBA && (
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <div><span className="font-medium text-foreground">Business Leader (SVP):</span> {selectedBA.businessLeader}</div>
                <div><span className="font-medium text-foreground">ESTC Rep:</span> {selectedBA.estcRep}</div>
                <div><span className="font-medium text-foreground">CIO Staff Engagement Point:</span> {selectedBA.cioStaff}</div>
              </div>
            )}
          </div>
          <Field label="Project Title" field="projectTitle" required placeholder="Enter a unique project name" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="IT Functional Owner (CIO Staff Member)" field="functionalOwner" type="person" required placeholder="Search by name or enter email..." />
            <Field label="ESTC Member (SVP/VP Sponsor)" field="estcMember" type="person" required placeholder="Search by name or enter email..." />
          </div>
          <Field label="IT Product Owner" field="itProductOwner" type="person" required placeholder="Search by name or enter email..." hint="The IT lead responsible for delivery" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Functional Area" field="functionalArea" type="select" required options={FUNCTIONAL_AREAS} />
            <Field label="Project Classification" field="projectClassification" type="select" required options={['Discretionary', 'Non-Discretionary']} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Category" field="category" type="select" required options={CATEGORIES} />
            <Field label="Initiative Type" field="initiativeType" type="select" required options={['Carryover', 'ESTC', 'Tactical']} />
          </div>
          {form.initiativeType === 'Carryover' && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)' }}>
              <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">This is a Carryover project. Please review and update all pre-filled fields from the prior year.</p>
            </div>
          )}
          <Field label="Project Narrative" field="projectNarrative" required rows={4} placeholder="Describe the problem statement and proposed solution..." hint="Problem statement and proposed solution" />
          <Field label="Does this initiative require architecture changes?" field="architectureChanges" type="radio" required options={['Yes', 'No']} />
        </div>
      );

      case 2: return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Project Start Date" field="projectStartDate" type="date" required />
            <Field label="Project End Date" field="projectEndDate" type="date" required hint="Must be after Start Date" />
          </div>
          <Field label="Estimated Baseline Resources" field="baselineResources" rows={2} placeholder="Existing staff allocated (e.g., 2 devs, 1 QA)" hint="Pending confirmation with Srini/Sabita — optional for now" />
          <Field label="Total # of Incremental FTEs" field="incrementalFtes" type="number" required placeholder="0" hint="Net-new headcount for this initiative" />
          {showFtes && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <Field label="Location" field="location" type="select" required options={LOCATIONS} />
              <Field label="Job Level" field="jobLevel" type="select" required options={JOB_LEVELS} />
            </div>
          )}
          <Field label="EDA Dependency" field="edaDependency" type="select" required options={EDA_OPTIONS} hint="Enterprise Data & Analytics dependency" />
          {showEDA && (
            <div className="animate-fade-in">
              <Field label="EDA Product Manager" field="edaProductManager" type="person" required placeholder="Search by name or enter email..." />
            </div>
          )}
        </div>
      );

      case 3: return (
        <div className="space-y-5">
          {/* Read-only references from Phase 1 */}
          <div className="rounded-lg p-4 bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">From Phase 1 (read-only)</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{form.category || '—'}</span></div>
              <div><span className="text-muted-foreground">Classification:</span> <span className="font-medium">{form.projectClassification || '—'}</span></div>
            </div>
          </div>

          <Field label="Outside Services — Incremental from FY27 only ($)" field="outsideServices" type="number" required placeholder="0" prefix="$" hint="Labor/consulting costs; enter $0 if none" />
          {showOS && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <Field label="Outside Services Estimated Start Date" field="osStartDate" type="date" required />
              <Field label="Outside Services Estimated End Date" field="osEndDate" type="date" required />
            </div>
          )}

          <Field label="Software Costs ($)" field="softwareCosts" type="number" required placeholder="0" prefix="$" hint="Enter $0 if none" />
          {showSW && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              <Field label="Software Estimated Start Date" field="softwareStartDate" type="date" required />
              <Field label="Software Term (months)" field="softwareTerm" type="number" required placeholder="e.g., 12" hint="Duration of software license in months" />
            </div>
          )}

          <Field label="Hardware Cost — CapEx ($)" field="hardwareCost" type="number" required placeholder="0" prefix="$" hint="Capital expenditure only; enter $0 if none" />
          {showHW && (
            <div className="animate-fade-in">
              <Field label="Hardware Estimated Receipt Date" field="hardwareReceiptDate" type="date" required />
            </div>
          )}

          {/* Total Funding Requested — Calculated */}
          <div className="rounded-xl p-4 border-2" style={{ borderColor: 'var(--accent-teal)', background: 'rgba(0,248,197,0.05)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Funding Requested</p>
                <p className="text-xs text-muted-foreground mt-0.5">= Outside Services + Software Costs + Hardware Cost</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-teal-muted)' }}>{fmtCurrency(totalFundingRequested)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="IT Funded" field="itFunded" type="select" required options={['Yes', 'No', 'Both']} />
            {showITAmount && (
              <div className="animate-fade-in">
                <Field label="IT Funding Amount ($)" field="itFundingAmount" type="number" required prefix="$" />
              </div>
            )}
          </div>

          {showBiz ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Business Funded" field="bizFunded" type="select" required options={['Yes', 'No']} />
              {showBizAmount && (
                <div className="animate-fade-in">
                  <Field label="Business Funding Amount ($)" field="bizFundingAmount" type="number" required prefix="$" />
                </div>
              )}
            </div>
          ) : (
            showBizAmount && (
              <div className="animate-fade-in">
                <Field label="Business Funding Amount ($)" field="bizFundingAmount" type="number" required prefix="$" hint="IT Funded = Both — Business Funding auto-enabled" />
              </div>
            )
          )}

          {fundingMismatch && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)' }}>
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Funding amounts ({fmtCurrency(fundingTotal)}) do not match Total Funding Requested ({fmtCurrency(totalFundingRequested)}). Please verify.
              </p>
            </div>
          )}

          <Field label="Other Comments" field="otherComments" rows={3} placeholder="Text only — do not include dollar amounts" hint="Additional context for Finance review (text only)" />
          {commentWarning && !errors.otherComments && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">Dollar amounts detected — please move financial values to the cost fields above.</p>
            </div>
          )}

          <Field label="Incremental Labor Costs ($)" field="incrementalLaborCosts" type="number" required prefix="$" hint="Total cost for the net-new FTEs captured in Phase 2" />
        </div>
      );

      case 4: return (
        <div className="space-y-5">
          <Field label="Total Project Cost — Estimated" field="totalProjectCost" type="number" prefix="$" placeholder="Optional — will be refined by Finance later" hint="Optional at time of initiative creation" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cost Savings — Estimated ($)" field="costSavings" type="number" prefix="$" placeholder="Optional" />
            <Field label="Revenue Increase — Estimated ($)" field="revenueIncrease" type="number" prefix="$" placeholder="Optional" />
          </div>
          <Field label="Business Value Details" field="businessValueDetails" rows={4} placeholder="Describe tangible and intangible benefits..." hint="Tangible and intangible benefits" />

          {/* ESTC Priority — read-only */}
          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">ESTC Priority Rank (assigned post-submission by ESTC)</label>
            <input
              type="text"
              value="— Assigned after submission"
              readOnly
              className="w-full h-10 px-3 rounded-lg border bg-muted text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          {showCompliance && (
            <div className="animate-fade-in">
              <Field label="Compliance / Regulatory Justification" field="complianceJustification" required rows={3} placeholder="Required for Non-Discretionary projects" hint="Required for Non-Discretionary projects" />
            </div>
          )}
        </div>
      );

      case 5: return (
        <div className="space-y-6">
          <div className="rounded-lg p-4 bg-muted/50 border border-border">
            <p className="text-sm font-medium mb-1">Ready to submit?</p>
            <p className="text-xs text-muted-foreground">Review all sections below. Click any section header to go back and edit.</p>
          </div>

          {/* Summary sections */}
          {[
            { title: 'Phase 1 — Project Identification', goTo: 1, items: [
              ['Project Title', form.projectTitle],
              ['IT Functional Owner', form.functionalOwner],
              ['ESTC Member', form.estcMember],
              ['IT Product Owner', form.itProductOwner],
              ['Functional Area', form.functionalArea],
              ['Classification', form.projectClassification],
              ['Category', form.category],
              ['Initiative Type', form.initiativeType],
              ['Architecture Changes', form.architectureChanges],
            ]},
            { title: 'Phase 2 — Timeline & Resources', goTo: 2, items: [
              ['Start Date', form.projectStartDate],
              ['End Date', form.projectEndDate],
              ['Incremental FTEs', form.incrementalFtes],
              ...(showFtes ? [['Location', form.location], ['Job Level', form.jobLevel]] : []),
              ['EDA Dependency', form.edaDependency],
              ...(showEDA ? [['EDA Product Manager', form.edaProductManager]] : []),
            ]},
            { title: 'Phase 3 — Financial Details', goTo: 3, items: [
              ['Outside Services', fmtCurrency(parseNum(form.outsideServices))],
              ['Software Costs', fmtCurrency(parseNum(form.softwareCosts))],
              ['Hardware Cost (CapEx)', fmtCurrency(parseNum(form.hardwareCost))],
              ['Total Funding Requested', fmtCurrency(totalFundingRequested)],
              ['IT Funded', form.itFunded],
              ...(showITAmount ? [['IT Funding Amount', fmtCurrency(parseNum(form.itFundingAmount))]] : []),
              ['Biz Funded', form.bizFunded],
              ...(showBizAmount ? [['Biz Funding Amount', fmtCurrency(parseNum(form.bizFundingAmount))]] : []),
              ['Incremental Labor Costs', fmtCurrency(parseNum(form.incrementalLaborCosts))],
            ]},
            { title: 'Phase 4 — Strategic Alignment', goTo: 4, items: [
              ['Total Project Cost', form.totalProjectCost ? fmtCurrency(parseNum(form.totalProjectCost)) : 'Not provided'],
              ['Cost Savings', form.costSavings ? fmtCurrency(parseNum(form.costSavings)) : 'Not provided'],
              ['Revenue Increase', form.revenueIncrease ? fmtCurrency(parseNum(form.revenueIncrease)) : 'Not provided'],
            ]},
          ].map((section: any) => (
            <div key={section.title} className="bg-card rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition"
                onClick={() => setPhase(section.goTo)}
              >
                <span className="text-sm font-semibold">{section.title}</span>
                <span className="text-xs text-muted-foreground">Edit →</span>
              </button>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(section.items ?? []).map(([label, val]: any, i: number) => (
                    <div key={i} className="text-sm">
                      <span className="text-muted-foreground">{label}: </span>
                      <span className="font-medium">{val || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Total highlight */}
          <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(0,248,197,0.08)', border: '2px solid var(--accent-teal)' }}>
            <p className="text-sm text-muted-foreground mb-1">Total Funding Requested</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--accent-teal-muted)' }}>{fmtCurrency(totalFundingRequested)}</p>
          </div>
        </div>
      );

      default: return null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {PHASES.map((p: any, i: number) => {
            const Icon = p.icon;
            const isActive = phase === p.id;
            const isComplete = phase > p.id;
            return (
              <React.Fragment key={p.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      isActive && 'ring-2 ring-offset-2 ring-offset-background',
                      isComplete ? 'text-white' : isActive ? 'text-white' : 'bg-muted text-muted-foreground'
                    )}
                    style={
                      isComplete ? { background: 'var(--accent-teal)', color: 'var(--brand-navy-950)' }
                      : isActive ? { background: 'var(--accent-teal)', color: 'var(--brand-navy-950)' }
                      : {}
                    }
                  >
                    {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={cn('text-xs mt-1.5 hidden sm:block', isActive ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {p.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2" style={{ background: phase > p.id ? 'var(--accent-teal)' : 'hsl(var(--border))' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Phase header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">{PHASES[phase - 1]?.label ?? ''}</h2>
        {phase < 5 && <p className="text-sm text-muted-foreground mt-1">Phase {phase} of 4 — All fields marked with <span className="text-destructive">*</span> are required</p>}
      </div>

      {/* Phase content */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        {renderPhase()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {phase > 1 ? (
          <Button variant="outline" onClick={goBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : <div />}
        {phase < 5 ? (
          <Button onClick={goNext}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting} className="px-8">
            <Send className="w-4 h-4 mr-2" /> Submit Initiative
          </Button>
        )}
      </div>
    </div>
  );
}
