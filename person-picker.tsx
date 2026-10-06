'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { User, Search, Check, AlertCircle } from 'lucide-react';
import { findDirectoryPeople, isKnownPerson } from '@/lib/org-directory';

interface PersonResult {
  name: string;
  email: string;
  role?: string; // present for org-directory (known) people
}

interface PersonPickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Merge org-directory matches (shown first) with live Graph results, de-duping
// by name/email. Directory entries carry a role label and a known email.
function mergeResults(dir: PersonResult[], graph: PersonResult[]): PersonResult[] {
  const out: PersonResult[] = [...dir];
  const seen = new Set(
    dir.flatMap((p) => [p.name.toLowerCase(), (p.email || '').toLowerCase()].filter(Boolean)),
  );
  for (const g of graph) {
    const n = (g.name || '').toLowerCase();
    const e = (g.email || '').toLowerCase();
    if ((n && seen.has(n)) || (e && seen.has(e))) continue;
    out.push(g);
    if (n) seen.add(n);
    if (e) seen.add(e);
  }
  return out.slice(0, 8);
}

export function PersonPicker({ value, onChange, placeholder, disabled, className, error: errorProp }: PersonPickerProps) {
  const [query, setQuery] = React.useState(value ?? '');
  const [results, setResults] = React.useState<PersonResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Keep local query in sync if parent resets value.
  React.useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  function handleChange(raw: string) {
    setQuery(raw);
    onChange(raw);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (raw.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Instant local suggestions from the org directory.
    const dir: PersonResult[] = findDirectoryPeople(raw.trim());
    if (dir.length > 0) {
      setResults(dir);
      setOpen(true);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/people/search?q=${encodeURIComponent(raw.trim())}`);
        const data = await res.json();
        const graph: PersonResult[] = data.results ?? [];
        const merged = mergeResults(dir, graph);
        setResults(merged);
        setOpen(merged.length > 0);
      } catch {
        setResults(dir);
        setOpen(dir.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function select(p: PersonResult) {
    const display = p.email || p.name;
    setQuery(display);
    onChange(display);
    setOpen(false);
  }

  // Close dropdown on outside click.
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Valid when a proper email was entered OR the value matches a known person.
  const isValid = EMAIL_REGEX.test(query) || isKnownPerson(query);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder ?? 'Search by name or enter email...'}
          disabled={disabled}
          className={cn(
            'w-full h-10 pl-9 pr-8 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            errorProp && 'border-destructive',
            disabled && 'bg-muted cursor-not-allowed',
            className,
          )}
        />
        {/* Validation indicator */}
        {query.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
          </span>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.map((p, i) => (
            <button
              key={i}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-3 transition-colors"
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
            >
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.role ? `${p.role}${p.email ? ` \u00b7 ${p.email}` : ''}` : p.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
          <Search className="w-4 h-4 animate-pulse" /> Searching directory...
        </div>
      )}
    </div>
  );
}
