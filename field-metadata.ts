// -----------------------------------------------------------------------------
// Shared field metadata for FY28 AOP submission fields.
// Single source of truth for labels, input types, and valid option lists so the
// intake wizard and the transcript-import review editor stay in sync and all
// choice fields are linked to the same valid values.
// -----------------------------------------------------------------------------

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean' | 'person';

export interface FieldMeta {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // for select
}

// Option lists (kept consistent with the intake wizard + transcript parser)
export const FUNCTIONAL_AREAS = [
  'Infrastructure', 'Finance', 'Human Resources', 'Legal', 'Corporate Development',
  'Sales', 'Marketing', 'Engineering', 'Customer Support',
  'Operations - Quality and Reliability', 'GTM Revenue Operations', 'Cloud Operations',
  'Supply Chain', 'Security', 'Data & Analytics', 'Corporate IT', 'EDA', 'Other',
];

export const CATEGORIES = [
  'Discretionary: Carry Over', 'Discretionary: Nice to Have', 'ESTC Prioritized',
  'KBR & KTLO: Must Do', 'Top Strategic', 'AI Investment',
];

export const INITIATIVE_TYPES = ['New', 'Carryover', 'ESTC'];
export const CLASSIFICATIONS = ['Discretionary', 'Non-Discretionary'];
export const EDA_OPTIONS = ['None', 'GTM', 'CSO', 'MDM', 'Finance', 'Enterprise', 'HR', 'Operations', 'Ops'];
export const LOCATIONS = ['US', 'India', 'Bangalore', 'Pune', 'Other'];
export const JOB_LEVELS = ['Staff', 'Senior', 'Principal', 'Senior Principal', 'Distinguished', 'Contractor', 'P3', 'P4', 'P5'];
export const IT_FUNDED = ['Yes', 'No', 'Both'];
export const BIZ_FUNDED = ['Yes', 'No'];

// The fields extracted by the transcript parser, in display order.
export const FIELD_META: FieldMeta[] = [
  { key: 'projectTitle', label: 'Project Title', type: 'text' },
  { key: 'projectNarrative', label: 'Narrative', type: 'textarea' },
  { key: 'initiativeType', label: 'Initiative Type', type: 'select', options: INITIATIVE_TYPES },
  { key: 'itProductOwner', label: 'IT Product Owner', type: 'person' },
  { key: 'estcMember', label: 'ESTC Sponsor', type: 'person' },
  { key: 'functionalOwner', label: 'IT Functional Owner', type: 'person' },
  { key: 'functionalArea', label: 'Functional Area', type: 'select', options: FUNCTIONAL_AREAS },
  { key: 'projectClassification', label: 'Classification', type: 'select', options: CLASSIFICATIONS },
  { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
  { key: 'complianceJustification', label: 'Compliance Justification', type: 'textarea' },
  { key: 'architectureChanges', label: 'Architecture Changes', type: 'boolean' },
  { key: 'edaDependency', label: 'EDA Dependency', type: 'select', options: EDA_OPTIONS },
  { key: 'edaProductManager', label: 'EDA Product Manager', type: 'person' },
  { key: 'projectStartDate', label: 'Start Date', type: 'date' },
  { key: 'projectEndDate', label: 'End Date', type: 'date' },
  { key: 'incrementalFtes', label: 'Incremental FTEs', type: 'number' },
  { key: 'location', label: 'Work Location', type: 'select', options: LOCATIONS },
  { key: 'jobLevel', label: 'Job Level', type: 'select', options: JOB_LEVELS },
  { key: 'outsideServices', label: 'Outside Services ($)', type: 'number' },
  { key: 'softwareCosts', label: 'Software Costs ($)', type: 'number' },
  { key: 'hardwareCost', label: 'Hardware Cost ($)', type: 'number' },
  { key: 'totalFundingRequested', label: 'Total Funding Requested ($)', type: 'number' },
  { key: 'incrementalLaborCosts', label: 'Incremental Labor Costs ($)', type: 'number' },
  { key: 'itFunded', label: 'IT Funded', type: 'select', options: IT_FUNDED },
  { key: 'itFundingAmount', label: 'IT Funding Amount ($)', type: 'number' },
  { key: 'bizFunded', label: 'Business Funded', type: 'select', options: BIZ_FUNDED },
  { key: 'bizFundingAmount', label: 'Business Funding Amount ($)', type: 'number' },
  { key: 'businessValueDetails', label: 'Business Value', type: 'textarea' },
  { key: 'costSavings', label: 'Cost Savings ($)', type: 'number' },
  { key: 'revenueIncrease', label: 'Revenue Increase ($)', type: 'number' },
  { key: 'otherComments', label: 'Other Comments', type: 'textarea' },
];

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_META.map((f) => [f.key, f.label]),
);
export const FIELD_ORDER = FIELD_META.map((f) => f.key);
export const FIELD_META_BY_KEY: Record<string, FieldMeta> = Object.fromEntries(
  FIELD_META.map((f) => [f.key, f]),
);

// Ensure a select always lists the current value even if the parser produced
// something outside the canonical option list (so nothing is silently lost).
export function optionsWithValue(options: string[] | undefined, value: any): string[] {
  const base = options ?? [];
  const v = value === null || value === undefined ? '' : String(value);
  if (v && v !== 'NEEDS FOLLOW-UP' && !base.includes(v)) return [v, ...base];
  return base;
}
