// -----------------------------------------------------------------------------
// SharePoint data store — the FY28 AOP list is the single source of truth.
// All submission reads/writes go to the SharePoint list via Microsoft Graph.
// Authentication uses the Abacus "viewer connector token": each inbound request
// carries the signed-in viewer's Abacus API key (x-abacus-user-api-key), which
// we exchange for a short-lived Microsoft Graph access token scoped to the
// viewer's own SharePoint connection. This works in the Abacus preview and in
// the deployed app. It does NOT work on raw localhost (no header is injected
// there) — that is expected.
// -----------------------------------------------------------------------------

import { headers } from 'next/headers';

const SITE_ID = process.env.SHAREPOINT_SITE_ID ?? '';
const LIST_ID = process.env.SHAREPOINT_LIST_ID ?? '';
const GRAPH = 'https://graph.microsoft.com/v1.0';

// App field (camelCase)  ->  SharePoint column internal name
export const FIELD_TO_COLUMN: Record<string, string> = {
  projectTitle: 'Title',
  submitterEmail: 'SubmitterEmail',
  submitterName: 'SubmitterName',
  status: 'Status',
  // Phase 1
  functionalOwner: 'FunctionalOwner',
  estcMember: 'ESTCMember',
  itProductOwner: 'ITProductOwner',
  functionalArea: 'FunctionalArea',
  projectClassification: 'ProjectClassification',
  category: 'Category',
  initiativeType: 'InitiativeType',
  projectNarrative: 'ProjectNarrative',
  architectureChanges: 'ArchitectureChanges',
  // Phase 2
  projectStartDate: 'ProjectStartDate',
  projectEndDate: 'ProjectEndDate',
  baselineResources: 'BaselineResources',
  incrementalFtes: 'IncrementalFtes',
  location: 'WorkLocation',
  jobLevel: 'JobLevel',
  edaDependency: 'EDADependency',
  edaProductManager: 'EDAProductManager',
  // Phase 3
  outsideServices: 'OutsideServices',
  osStartDate: 'OSStartDate',
  osEndDate: 'OSEndDate',
  softwareCosts: 'SoftwareCosts',
  softwareStartDate: 'SoftwareStartDate',
  softwareTerm: 'SoftwareTerm',
  hardwareCost: 'HardwareCost',
  hardwareReceiptDate: 'HardwareReceiptDate',
  totalFundingRequested: 'TotalFundingRequested',
  itFunded: 'ITFunded',
  itFundingAmount: 'ITFundingAmount',
  bizFunded: 'BizFunded',
  bizFundingAmount: 'BizFundingAmount',
  otherComments: 'OtherComments',
  incrementalLaborCosts: 'IncrementalLaborCosts',
  // Phase 4
  totalProjectCost: 'TotalProjectCost',
  costSavings: 'CostSavings',
  revenueIncrease: 'RevenueIncrease',
  businessValueDetails: 'BusinessValueDetails',
  priorityForEstimation: 'PriorityForEstimation',
  estcPriorityVoting: 'ESTCPriorityVoting',
  complianceJustification: 'ComplianceJustification',
  // Phase 5 — Admin / Governance
  decision: 'Decision',
  includedInFy28Aop: 'IncludedInFY28AOP',
  priorityRank: 'PriorityRank',
  financialValidation: 'FinancialValidation',
  estcPriorityRank: 'ESTCPriorityRank',
  snowDemandId: 'SnowDemandId',
  snowProjectId: 'SnowProjectId',
  oracleId: 'OracleId',
  adminNotes: 'AdminNotes',
};

const DATE_FIELDS = new Set([
  'projectStartDate', 'projectEndDate', 'osStartDate', 'osEndDate',
  'softwareStartDate', 'hardwareReceiptDate',
]);
const NUMBER_FIELDS = new Set([
  'incrementalFtes', 'outsideServices', 'softwareCosts', 'softwareTerm',
  'hardwareCost', 'totalFundingRequested', 'itFundingAmount', 'bizFundingAmount',
  'incrementalLaborCosts', 'totalProjectCost', 'costSavings', 'revenueIncrease',
  'estcPriorityVoting', 'priorityRank', 'estcPriorityRank',
]);
const BOOL_FIELDS = new Set([
  'architectureChanges', 'includedInFy28Aop', 'financialValidation',
]);

// ---------------------------------------------------------------------------
// Graph token via the viewer connector token API
// ---------------------------------------------------------------------------
// Service-identity access to SharePoint (same model the BTO AI registry uses):
// the app authenticates to the SharePoint list with ONE stored application
// credential (the app's ABACUSAI_API_KEY, whose owner has SharePoint connected
// in Abacus) for EVERY viewer. This means end users do NOT need to personally
// connect SharePoint in Abacus to read or submit to the list. Individual
// submitter identity is still captured separately via getViewerIdentity().
async function getGraphToken(): Promise<string> {
  // Primary: stored service credential. Fallback: the viewer's own key if present.
  let apiKey = process.env.ABACUSAI_API_KEY ?? '';
  if (!apiKey) {
    const h = await headers();
    apiKey = h.get('x-abacus-user-api-key') ?? '';
  }
  if (!apiKey) {
    throw new Error('SharePoint service credential is not configured.');
  }
  const res = await fetch('https://api.abacus.ai/api/_getViewerConnectorToken', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ service: 'SHAREPOINT' }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const body = await res.json().catch(() => ({} as any));
      const url = String(body?.error ?? '').match(/https?:\/\/\S+/)?.[0] ?? '';
      throw new Error(`SharePoint is not connected for the app service account. ${url}`.trim());
    }
    if (res.status === 403) throw new Error('Unable to authenticate with Abacus.');
    throw new Error('Could not connect to SharePoint.');
  }
  const json = await res.json();
  const token = json?.result?.access_token;
  if (!token) throw new Error('Could not obtain a SharePoint access token.');
  return token as string;
}

export async function getViewerIdentity(): Promise<{ email: string; name: string }> {
  const h = await headers();
  const email = h.get('x-abacus-user-email') ?? process.env.MOCK_USER_EMAIL ?? 'unknown@netapp.com';
  const name = h.get('x-abacus-user-name') ?? process.env.MOCK_USER_NAME ?? email;
  return { email, name };
}

function toDateOnly(v: any): string | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// App data object -> SharePoint fields payload
export function mapToFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [appKey, col] of Object.entries(FIELD_TO_COLUMN)) {
    if (!(appKey in data)) continue;
    let val = data[appKey];
    if (val === undefined) continue;
    if (DATE_FIELDS.has(appKey)) {
      val = toDateOnly(val);
      if (val === null) continue;
    } else if (NUMBER_FIELDS.has(appKey)) {
      if (val === '' || val === null) { val = null; }
      else { const n = Number(val); val = isNaN(n) ? null : n; }
      if (val === null) continue;
    } else if (BOOL_FIELDS.has(appKey)) {
      val = Boolean(val);
    } else {
      val = val === null || val === undefined ? '' : String(val);
    }
    fields[col] = val;
  }
  return fields;
}

// SharePoint item -> app submission object
export function mapFromFields(item: any): Record<string, any> {
  const f = item?.fields ?? {};
  const out: Record<string, any> = {
    id: String(item?.id ?? ''),
    createdAt: item?.createdDateTime ?? null,
    updatedAt: item?.lastModifiedDateTime ?? null,
  };
  for (const [appKey, col] of Object.entries(FIELD_TO_COLUMN)) {
    let val = f[col];
    if (DATE_FIELDS.has(appKey)) {
      out[appKey] = val ? new Date(val).toISOString() : null;
    } else if (NUMBER_FIELDS.has(appKey)) {
      out[appKey] = val === undefined || val === null ? null : Number(val);
    } else if (BOOL_FIELDS.has(appKey)) {
      out[appKey] = Boolean(val);
    } else {
      out[appKey] = val ?? null;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
async function graphFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SharePoint request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res;
}

export async function createSubmission(data: Record<string, any>): Promise<string> {
  const token = await getGraphToken();
  const fields = mapToFields(data);
  const res = await graphFetch(token, `/sites/${SITE_ID}/lists/${LIST_ID}/items`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  const created = await res.json();
  return String(created?.id ?? '');
}

export async function listSubmissions(opts?: { email?: string; all?: boolean }): Promise<any[]> {
  const token = await getGraphToken();
  let path = `/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields&$top=500&$orderby=createdDateTime desc`;
  const res = await graphFetch(token, path);
  const json = await res.json();
  let items: any[] = (json?.value ?? []).map(mapFromFields);
  if (opts?.email && !opts?.all) {
    const email = opts.email.toLowerCase();
    items = items.filter((s) => String(s.submitterEmail ?? '').toLowerCase() === email);
  }
  return items;
}

export async function getSubmission(id: string): Promise<any | null> {
  const token = await getGraphToken();
  try {
    const res = await graphFetch(token, `/sites/${SITE_ID}/lists/${LIST_ID}/items/${id}?expand=fields`);
    const item = await res.json();
    return mapFromFields(item);
  } catch (e: any) {
    if (String(e?.message ?? '').includes('(404)')) return null;
    throw e;
  }
}

export async function updateSubmission(id: string, patch: Record<string, any>): Promise<void> {
  const token = await getGraphToken();
  const fields = mapToFields(patch);
  await graphFetch(token, `/sites/${SITE_ID}/lists/${LIST_ID}/items/${id}/fields`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}
