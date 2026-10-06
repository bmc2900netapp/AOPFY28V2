// ---------------------------------------------------------------------------
// Duplicate / similarity detection for FY28 AOP initiatives (Tier 2 — fuzzy).
//
// Goal: flag when a new initiative looks very similar to one that already
// exists in the SharePoint list, so the same work isn't entered twice.
// Scoring is title-driven (token overlap + character bigrams) and lightly
// boosted when supporting fields (Functional Area, Category, Owner) match.
// Nothing here blocks a save — the UI surfaces matches as a warning only.
// ---------------------------------------------------------------------------

export type DupLevel = 'high' | 'possible';

export interface Candidate {
  projectTitle?: string | null;
  functionalArea?: string | null;
  category?: string | null;
  functionalOwner?: string | null;
  projectNarrative?: string | null;
}

export interface ExistingItem extends Candidate {
  id: string;
  status?: string | null;
  submitterName?: string | null;
}

export interface DupMatch {
  id: string;
  projectTitle: string;
  functionalArea: string;
  category: string;
  status: string;
  submitterName: string;
  score: number;        // 0..1 overall similarity
  titleScore: number;   // 0..1 title-only similarity
  level: DupLevel;
  sharedTerms: string[];   // meaningful words both titles share
  matchedFields: string[]; // supporting fields that also match (labels)
}

// Thresholds (overall score). Tunable in one place.
export const HIGH_THRESHOLD = 0.72;     // "very similar" — flag prominently
export const POSSIBLE_THRESHOLD = 0.45; // "possible duplicate" — worth a look

// Words that carry no distinguishing signal in an initiative title.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by',
  'at', 'from', 'as', 'is', 'are', 'be', 'into', 'per', 'via', 'our', 'new',
  'project', 'projects', 'initiative', 'initiatives', 'program', 'programme',
  'system', 'systems', 'platform', 'solution', 'solutions', 'implementation',
  'implement', 'implementing', 'phase', 'fy27', 'fy28', 'fy29', 'aop', 'it',
  'enterprise', 'global', 'corporate', 'management', 'process', 'improvement',
  'update', 'upgrade', 'migration', 'migrate', 'modernization', 'modernize',
]);

export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Meaningful tokens (normalized, stopwords & 1-char tokens removed).
export function tokenize(s: string | null | undefined): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// Overlap relative to the smaller set — catches "X" fully contained in "X Rollout".
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

function bigrams(s: string): Set<string> {
  const str = normalize(s).replace(/\s/g, '');
  const out = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) out.add(str.slice(i, i + 2));
  return out;
}

// Sorensen-Dice coefficient over character bigrams — robust to typos/reorder.
function diceCoefficient(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}

export function titleSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  const tokenJ = jaccard(ta, tb);
  const tokenC = containment(ta, tb);
  const dice = diceCoefficient(a ?? '', b ?? '');
  // Blend: token overlap dominates; containment and char-dice catch the rest.
  return Math.max(tokenJ, 0.92 * tokenC, 0.85 * dice);
}

function eq(a?: string | null, b?: string | null): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na.length > 0 && na === nb;
}

export function scoreMatch(cand: Candidate, item: ExistingItem): DupMatch | null {
  const titleScore = titleSimilarity(cand.projectTitle, item.projectTitle);
  if (titleScore <= 0) return null;

  // Supporting-field boosts (each nudges the score toward 1, capped).
  const matchedFields: string[] = [];
  let boost = 0;
  if (eq(cand.functionalArea, item.functionalArea)) { boost += 0.08; matchedFields.push('Functional Area'); }
  if (eq(cand.category, item.category)) { boost += 0.05; matchedFields.push('Category'); }
  if (eq(cand.functionalOwner, item.functionalOwner)) { boost += 0.06; matchedFields.push('Functional Owner'); }

  // Narrative overlap gives a small extra signal when titles are borderline.
  const narrJ = jaccard(new Set(tokenize(cand.projectNarrative)), new Set(tokenize(item.projectNarrative)));
  if (narrJ >= 0.25) { boost += Math.min(0.08, narrJ * 0.12); }

  const score = Math.min(1, titleScore + (1 - titleScore) * boost);
  if (score < POSSIBLE_THRESHOLD) return null;

  const ta = new Set(tokenize(cand.projectTitle));
  const sharedTerms = [...new Set(tokenize(item.projectTitle))].filter((t) => ta.has(t));

  return {
    id: item.id,
    projectTitle: item.projectTitle ?? '',
    functionalArea: item.functionalArea ?? '',
    category: item.category ?? '',
    status: item.status ?? '',
    submitterName: item.submitterName ?? '',
    score,
    titleScore,
    level: score >= HIGH_THRESHOLD ? 'high' : 'possible',
    sharedTerms,
    matchedFields,
  };
}

export function findSimilar(
  cand: Candidate,
  existing: ExistingItem[],
  opts?: { excludeId?: string; limit?: number },
): DupMatch[] {
  if (!normalize(cand.projectTitle)) return [];
  const limit = opts?.limit ?? 5;
  const out: DupMatch[] = [];
  for (const item of existing ?? []) {
    if (!item?.id) continue;
    if (opts?.excludeId && String(item.id) === String(opts.excludeId)) continue;
    if (!normalize(item.projectTitle)) continue;
    const m = scoreMatch(cand, item);
    if (m) out.push(m);
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
