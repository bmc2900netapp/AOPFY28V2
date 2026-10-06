'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  BarChart3, DollarSign, FileText, Download, Search, Filter,
  TrendingUp, Layers, PieChart as PieIcon, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import dynamic from 'next/dynamic';

const Charts = dynamic(() => import('./admin-charts'), { ssr: false, loading: () => <div className="h-64 bg-muted/50 rounded-xl animate-pulse" /> });

interface Sub {
  id: string;
  projectTitle: string;
  submitterName: string;
  submitterEmail: string;
  functionalArea: string;
  category: string;
  totalFundingRequested: number;
  status: string;
  decision: string;
  createdAt: string;
}

const statusColor: Record<string, string> = {
  'Pending Review': 'bg-amber-100 text-amber-800',
  'Approved': 'bg-emerald-100 text-emerald-800',
  'Denied': 'bg-red-100 text-red-800',
  'Backlog': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-gray-100 text-gray-600',
};

function fmt(v: number | null | undefined): string {
  return '$' + (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Searchable columns: label + value extractor
const SEARCH_COLUMNS: { key: string; label: string; get: (s: Sub) => string }[] = [
  { key: 'projectTitle', label: 'Project Title', get: (s) => s?.projectTitle ?? '' },
  { key: 'submitterName', label: 'Submitter Name', get: (s) => s?.submitterName ?? '' },
  { key: 'submitterEmail', label: 'Submitter Email', get: (s) => s?.submitterEmail ?? '' },
  { key: 'functionalArea', label: 'Area', get: (s) => s?.functionalArea ?? '' },
  { key: 'category', label: 'Category', get: (s) => s?.category ?? '' },
  { key: 'status', label: 'Status', get: (s) => s?.status ?? '' },
  { key: 'decision', label: 'Decision', get: (s) => s?.decision ?? '' },
  { key: 'totalFundingRequested', label: 'Funding', get: (s) => String(s?.totalFundingRequested ?? '') },
  { key: 'createdAt', label: 'Date', get: (s) => (s?.createdAt ? new Date(s.createdAt).toLocaleDateString('en-US') : '') },
];

type SortDir = 'asc' | 'desc';

const SORT_COLUMNS: { key: string; label: string; align?: string; hiddenClass?: string }[] = [
  { key: 'projectTitle', label: 'Project Title' },
  { key: 'submitterName', label: 'Submitter', hiddenClass: 'hidden md:table-cell' },
  { key: 'functionalArea', label: 'Area', hiddenClass: 'hidden lg:table-cell' },
  { key: 'category', label: 'Category', hiddenClass: 'hidden lg:table-cell' },
  { key: 'totalFundingRequested', label: 'Funding', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Date', hiddenClass: 'hidden sm:table-cell' },
];

function sortValue(s: Sub, key: string): string | number {
  if (key === 'totalFundingRequested') return s?.totalFundingRequested ?? 0;
  if (key === 'createdAt') return s?.createdAt ?? '';
  if (key === 'submitterName') return (s?.submitterName || s?.submitterEmail?.split?.('@')?.[0] || '').toLowerCase();
  return ((s as any)?.[key] ?? '').toString().toLowerCase();
}

export function AdminDashboardClient({ submissions, error }: { submissions: Sub[]; error?: string | null }) {
  const [search, setSearch] = useState('');
  const [searchColumn, setSearchColumn] = useState('all');
  const [filterArea, setFilterArea] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const areas = useMemo(() => [...new Set((submissions ?? []).map((s: Sub) => s?.functionalArea).filter(Boolean))].sort(), [submissions]);
  const categories = useMemo(() => [...new Set((submissions ?? []).map((s: Sub) => s?.category).filter(Boolean))].sort(), [submissions]);
  const statuses = useMemo(() => [...new Set((submissions ?? []).map((s: Sub) => s?.status).filter(Boolean))].sort(), [submissions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (submissions ?? []).filter((s: Sub) => {
      if (q) {
        const cols = searchColumn === 'all' ? SEARCH_COLUMNS : SEARCH_COLUMNS.filter((c) => c.key === searchColumn);
        if (!cols.some((c) => c.get(s).toLowerCase().includes(q))) return false;
      }
      if (filterArea && s?.functionalArea !== filterArea) return false;
      if (filterCategory && s?.category !== filterCategory) return false;
      if (filterStatus && s?.status !== filterStatus) return false;
      return true;
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
  }, [submissions, search, searchColumn, filterArea, filterCategory, filterStatus, sortKey, sortDir]);

  const totalFunding = useMemo(() => (submissions ?? []).reduce((sum: number, s: Sub) => sum + (s?.totalFundingRequested ?? 0), 0), [submissions]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">FY28 AOP portfolio overview and management</p>
        </div>
        <a href="/api/admin/export" download>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
        </a>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Submissions', value: String((submissions ?? []).length), icon: FileText, color: 'var(--accent-teal)' },
          { label: 'Total Funding Requested', value: fmt(totalFunding), icon: DollarSign, color: 'var(--accent-teal-muted)' },
          { label: 'Pending Review', value: String((submissions ?? []).filter((s: Sub) => s?.status === 'Pending Review').length), icon: Layers, color: '#f59e0b' },
          { label: 'Approved', value: String((submissions ?? []).filter((s: Sub) => s?.status === 'Approved').length), icon: TrendingUp, color: '#10b981' },
        ].map((m: any) => (
          <div key={m.label} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
              <m.icon className="w-4 h-4" style={{ color: m.color }} />
            </div>
            <p className="text-2xl font-bold mt-2 tracking-tight">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <Charts submissions={submissions} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 mt-6">
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
        <select value={searchColumn} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchColumn(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-card text-sm">
          <option value="all">All columns</option>
          {SEARCH_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={filterArea} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterArea(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-card text-sm">
          <option value="">All Areas</option>
          {areas.map((a: string) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterCategory} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-card text-sm">
          <option value="">All Categories</option>
          {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-card text-sm">
          <option value="">All Statuses</option>
          {statuses.map((st: string) => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      {/* Submissions table */}
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
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No submissions found</td></tr>
              ) : filtered.map((s: Sub) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/submission/${s.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-teal-muted)' }}>
                      {s?.projectTitle ?? 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{s?.submitterName || s?.submitterEmail?.split?.('@')?.[0] || '-'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{s?.functionalArea ?? '-'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{s?.category ?? '-'}</td>
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
    </div>
  );
}
