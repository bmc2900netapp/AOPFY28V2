'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { VERSION_LABEL, VERSION_FULL } from '@/lib/version';
import {
  Building2, FileText, PlusCircle, LayoutDashboard,
  List, ChevronLeft, ChevronRight, User,
  Menu, X, FileUp
} from 'lucide-react';

interface ShellProps {
  user: { id: string; email: string; name?: string | null; role: string };
  children: React.ReactNode;
}

const requestorLinks = [
  { href: '/dashboard', label: 'My Submissions', icon: FileText },
  { href: '/dashboard/new', label: 'Manual Intake', icon: PlusCircle },
  { href: '/dashboard/transcript', label: 'Import Transcript', icon: FileUp },
];

const adminLinks = [
  { href: '/dashboard/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin/submissions', label: 'All Submissions', icon: List },
];

export function DashboardShell({ user, children }: ShellProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const allLinks = [...requestorLinks, ...(isAdmin ? adminLinks : [])];

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed z-50 top-0 left-0 h-full flex flex-col transition-all duration-200 ease-in-out',
          'lg:relative lg:z-auto',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ background: 'var(--brand-navy-900)' }}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-14 px-4 border-b border-white/10', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-teal)' }}>
            <Building2 className="w-5 h-5" style={{ color: 'var(--brand-navy-950)' }} />
          </div>
          {!collapsed && <span className="ml-3 text-white font-semibold text-sm tracking-tight">FY28 AOP Intake</span>}
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {allLinks.map((link: any) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname?.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
                style={isActive ? { background: 'var(--accent-teal)', color: 'var(--brand-navy-950)' } : {}}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Version */}
        <div className={cn('px-3 pb-2', collapsed && 'px-0 flex justify-center')} title={VERSION_FULL}>
          <span className="text-[11px] font-medium text-white/40">
            {collapsed ? VERSION_LABEL : VERSION_FULL}
          </span>
        </div>

        {/* Collapse toggle */}
        <div className="hidden lg:flex px-2 pb-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 text-xs transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-foreground tracking-tight hidden sm:block">
              {allLinks.find((l: any) => pathname === l.href || (l.href !== '/dashboard' && pathname?.startsWith(l.href)))?.label ?? 'FY28 AOP Intake'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground tabular-nums" title={VERSION_FULL}>
              {VERSION_LABEL}
            </span>
            {isAdmin && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-teal)', color: 'var(--brand-navy-950)' }}>
                Admin
              </span>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium leading-none">{user?.name ?? user?.email?.split('@')?.[0] ?? 'User'}</div>
                <div className="text-xs text-muted-foreground" suppressHydrationWarning>{user?.email ?? ''}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
