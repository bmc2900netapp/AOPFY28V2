'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, PlusCircle, DollarSign, Clock, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Sub {
  id: string;
  projectTitle: string;
  functionalArea: string;
  category: string;
  totalFundingRequested: number;
  status: string;
  createdAt: string;
}

const statusColor: Record<string, string> = {
  'Pending Review': 'bg-amber-100 text-amber-800',
  'Approved': 'bg-emerald-100 text-emerald-800',
  'Denied': 'bg-red-100 text-red-800',
  'Backlog': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-gray-100 text-gray-600',
};

function fmt(val: number | null | undefined): string {
  return '$' + (val ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Searchable columns: label + value extractor
const SEARCH_COLUMNS: { key: string; label: string; get: (s: Sub) => string }[] = [
  { key: 'projectTitle', label: 'Project Title', get: (s) => s?.projectTitle ?? '' },
  { key: 'functionalArea', label: 'Area', get: (s) => s?.functionalArea ?? '' },
  { key: 'category', label: 'Category', get: (s) => s?.category ?? '' },
  { key: 'status', label: 'Status', get: (s) => s?.status ?? '' },
  { key: 'totalFundingRequested', label: 'Funding', get: (s) => String(s?.totalFundingRequested ?? '') },
  { key: 'createdAt', label: 'Submitted', get: (s) => (s?.createdAt ? new Date(s.createdAt).toLocaleDateString('en-US') : '') },
];

type SortDir = 'asc' | 'desc';

const SORT_COLUMNS: { key: string; label: string; align?: string; hiddenClass?: string; numeric?: boolean }[] = [
  { key: 'projectTitle', label: 'Project Title' },
  { key: 'functionalArea', label: 'Area', hiddenClass: 'hidden md:table-cell' },
  { key: 'category', label: 'Category', hiddenClass: 'hidden lg:table-cell' },
  { key: 'totalFundingRequested', label: 'Funding', align: 'right', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Submitted', hiddenClass: 'hidden sm:table-cell' },
];

function sortValue(s: Sub, key: string): string | number {
  if (key === 'totalFundingRequested') return s?.totalFundingRequested ?? 0;
  if (key === 'createdAt') return s?.createdAt ?? '';
  return ((s as any)?.[key] ?? '').toString().toLowerCase();
}

export function MySubmissionsClient({ submissions, error }: { submissions: Sub[]; error?: string | null }) {
  const [search, setSearch] = React.useState('');
  const [searchColumn, setSearchColumn] = React.useState('all');
  const [sortKey, setSortKey] = React.useState('');
  const [sortDir, setSortDir] = React.useState<SortDir>('asc');

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = React.useMemo(() => {
    let list = (submissions ?? []).filter((s: Sub) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const cols = searchColumn === 'all' ? SEARCH_COLUMNS : SEARCH_COLUMNS.filter((c) => c.key === searchColumn);
      return cols.some((c) => c.get(s).toLowerCase().includes(q));
    });
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [submissions, search, searchColumn, sortKey, sortDir]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Submissions</h2>
          <p className="text-sm text-muted-foreground mt-1">Track your FY28 AOP initiative submissions</p>
        </div>
        <Link href="/dashboard/new">
          <Button><PlusCircle className="w-4 h-4 mr-2" /> Manual Intake</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder={searchColumn === 'all' ? 'Search all columns...' : `Search by ${SEARCH_COLUMNS.find((c) => c.key === searchColumn)?.label ?? ''}...`}
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={searchColumn}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchColumn(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-card text-sm"
        >
          <option value="all">All columns</option>
          {SEARCH_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl p-12 text-center border border-border">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {(submissions ?? []).length === 0 ? 'No submissions yet' : 'No matching submissions'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {(submissions ?? []).length === 0 ? 'Start by creating a new FY28 AOP initiative intake.' : 'Try a different search term.'}
          </p>
          {(submissions ?? []).length === 0 && (
            <Link href="/dashboard/new">
              <Button><PlusCircle className="w-4 h-4 mr-2" /> Create First Intake</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {SORT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'font-medium text-muted-foreground px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        col.hiddenClass,
                      )}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: Sub) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/submission/${s.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-teal-muted)' }}>
                        {s?.projectTitle ?? 'Untitled'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{s?.functionalArea ?? '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{s?.category ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(s?.totalFundingRequested)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full', statusColor[s?.status ?? ''] ?? 'bg-gray-100 text-gray-600')}>
                        {s?.status ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                      {s?.createdAt ? new Date(s.createdAt).toLocaleDateString('en-US') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
