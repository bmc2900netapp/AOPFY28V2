'use client';

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#00f8c5', '#60B5FF', '#FF9149', '#FF9898', '#FF90BB', '#80D8C3', '#A19AD3', '#72BF78'];

interface Sub {
  category: string;
  functionalArea: string;
  status: string;
  totalFundingRequested: number;
}

export default function AdminCharts({ submissions }: { submissions: Sub[] }) {
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    (submissions ?? []).forEach((s: Sub) => {
      const key = s?.category ?? 'Unknown';
      map[key] = (map[key] ?? 0) + (s?.totalFundingRequested ?? 0);
    });
    return Object.entries(map).map(([name, value]: [string, number]) => ({ name: name?.length > 20 ? name.substring(0, 18) + '...' : name, value }));
  }, [submissions]);

  const byArea = useMemo(() => {
    const map: Record<string, number> = {};
    (submissions ?? []).forEach((s: Sub) => {
      const key = s?.functionalArea ?? 'Unknown';
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]: [string, number]) => ({ name, value })).sort((a: any, b: any) => (b?.value ?? 0) - (a?.value ?? 0)).slice(0, 10);
  }, [submissions]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    (submissions ?? []).forEach((s: Sub) => {
      const key = s?.status ?? 'Unknown';
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]: [string, number]) => ({ name, value }));
  }, [submissions]);

  if ((submissions ?? []).length === 0) {
    return <div className="text-center text-muted-foreground py-8">No data to visualize yet.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Funding by Category */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Funding by Category</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis type="number" tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" tickLine={false} tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v: number) => ['$' + v.toLocaleString('en-US'), 'Funding']} />
              <Bar dataKey="value" fill="#00f8c5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Submissions by Area */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Submissions by Functional Area</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byArea} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tickLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#60B5FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">Status Breakdown</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                {byStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: '#334155' }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
