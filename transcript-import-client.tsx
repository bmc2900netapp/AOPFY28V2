'use client';

import React from 'react';
import Link from 'next/link';
import {
  UploadCloud, FileText, Sparkles, ClipboardList, ListChecks, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Save, X, FileUp, Type,
  Copy, Mail, Download, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PersonPicker } from '@/components/ui/person-picker';
import {
  FIELD_META, FIELD_ORDER, FIELD_META_BY_KEY, optionsWithValue,
  type FieldMeta,
} from '@/lib/field-metadata';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Initiative {
  title: string;
  status: string; // COMPLETE | NEEDS FOLLOW-UP
  summary?: string;
  segmentationUncertain?: boolean;
  fields: Record<string, any>;
  followUps?: string[];
  confidenceNotes?: string[];
}

interface ParseResult {
  summary: string;
  nextSteps: string[];
  initiatives: Initiative[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const NEEDS = 'NEEDS FOLLOW-UP';

// Key for persisting the working parse draft in the browser so it survives
// tab navigation and page refreshes until the user clears it.
const DRAFT_STORAGE_KEY = 'fy28:transcript:draft:v1';

function isMissing(v: any): boolean {
  return v === NEEDS || v === null || v === undefined || v === '';
}

// Build a POST-ready payload from parsed fields (drop NEEDS FOLLOW-UP sentinels)
function buildPayload(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (v === NEEDS) continue;
    out[k] = v;
  }
  return out;
}

// Convert a raw input value into the stored value based on the field type.
function coerceValue(meta: FieldMeta, raw: string): any {
  if (meta.type === 'boolean') {
    if (raw === 'Yes') return true;
    if (raw === 'No') return false;
    return '';
  }
  if (meta.type === 'number') {
    if (raw === '') return '';
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

// Value shown in the editor input (NEEDS sentinel becomes an empty field)
function editorValue(meta: FieldMeta, v: any): string {
  if (v === NEEDS || v === null || v === undefined) return '';
  if (meta.type === 'boolean') {
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    return '';
  }
  return String(v);
}

const inputClass =
  'w-full h-9 px-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function FieldEditor({
  meta, value, onChange,
}: { meta: FieldMeta; value: any; onChange: (raw: string) => void }) {
  const val = editorValue(meta, value);

  if (meta.type === 'textarea') {
    return (
      <textarea
        value={val}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={cn(inputClass, 'h-auto py-2 resize-y')}
      />
    );
  }
  if (meta.type === 'select' || meta.type === 'boolean') {
    const opts = meta.type === 'boolean' ? ['Yes', 'No'] : optionsWithValue(meta.options, value);
    return (
      <select value={val} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">— Select —</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (meta.type === 'number') {
    return (
      <input type="number" value={val} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    );
  }
  if (meta.type === 'date') {
    return (
      <input type="date" value={val} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    );
  }
  if (meta.type === 'person') {
    return (
      <PersonPicker
        value={val}
        onChange={onChange}
        placeholder="Search by name or enter email..."
      />
    );
  }
  return (
    <input type="text" value={val} onChange={(e) => onChange(e.target.value)} className={inputClass} />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TranscriptImportClient() {
  const [mode, setMode] = React.useState<'upload' | 'paste'>('upload');
  const [file, setFile] = React.useState<File | null>(null);
  const [pasteText, setPasteText] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);

  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ParseResult | null>(null);

  const [selected, setSelected] = React.useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
  const [saveStates, setSaveStates] = React.useState<Record<number, SaveState>>({});
  const [savedIds, setSavedIds] = React.useState<Record<number, string>>({});
  const [saveErrors, setSaveErrors] = React.useState<Record<number, string>>({});
  const [copiedSteps, setCopiedSteps] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const hydratedRef = React.useRef(false);

  // Restore any persisted draft on first mount (client-only — hydration safe).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.result?.initiatives?.length) {
          setResult(saved.result);
          setSelected(saved.selected ?? {});
          setExpanded(saved.expanded ?? {});
          setSaveStates(saved.saveStates ?? {});
          setSavedIds(saved.savedIds ?? {});
        }
      }
    } catch {
      /* corrupt/unavailable storage — ignore */
    }
    hydratedRef.current = true;
  }, []);

  // Persist the working draft whenever meaningful state changes.
  React.useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (result?.initiatives?.length) {
        // Only persist terminal 'saved' states (never transient 'saving'/'error').
        const persistStates: Record<number, SaveState> = {};
        for (const [k, v] of Object.entries(saveStates)) {
          if (v === 'saved') persistStates[Number(k)] = 'saved';
        }
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ result, selected, expanded, saveStates: persistStates, savedIds }),
        );
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      /* storage full/unavailable — ignore */
    }
  }, [result, selected, expanded, saveStates, savedIds]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    resetResults();
    setParseError(null);
    setFile(null);
    setPasteText('');
  }

  const canParse = mode === 'upload' ? !!file : pasteText.trim().length > 0;

  function resetResults() {
    setResult(null);
    setSelected({});
    setExpanded({});
    setSaveStates({});
    setSavedIds({});
    setSaveErrors({});
  }

  async function handleParse() {
    setParsing(true);
    setParseError(null);
    resetResults();
    try {
      let res: Response;
      if (mode === 'upload' && file) {
        const fd = new FormData();
        fd.append('file', file);
        res = await fetch('/api/transcript/parse', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/transcript/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pasteText }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Parsing failed.');
      }
      setResult(data);
      if (!data?.initiatives?.length) {
        setParseError('No initiatives were found in this transcript. Check the content and try again.');
      }
    } catch (e: any) {
      setParseError(e?.message ?? 'Something went wrong while parsing the transcript.');
    } finally {
      setParsing(false);
    }
  }

  // Edit a field value on a parsed initiative (immutable update)
  function updateField(index: number, key: string, raw: string) {
    const meta = FIELD_META_BY_KEY[key];
    const value = meta ? coerceValue(meta, raw) : raw;
    setResult((prev) => {
      if (!prev) return prev;
      const initiatives = prev.initiatives.map((it, i) => {
        if (i !== index) return it;
        return { ...it, fields: { ...(it.fields ?? {}), [key]: value } };
      });
      return { ...prev, initiatives };
    });
  }

  // ---- Next Steps actions (#5) --------------------------------------------
  function nextStepsText(): string {
    const lines: string[] = ['FY28 AOP — Next Steps', ''];
    (result?.nextSteps ?? []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    if (result?.summary) {
      lines.push('', 'Conversation summary:', result.summary);
    }
    return lines.join('\n');
  }

  async function copyNextSteps() {
    try {
      await navigator.clipboard.writeText(nextStepsText());
      setCopiedSteps(true);
      setTimeout(() => setCopiedSteps(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  function emailNextSteps() {
    const subject = encodeURIComponent('FY28 AOP — Next Steps');
    const body = encodeURIComponent(nextStepsText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function downloadNextSteps() {
    const blob = new Blob([nextStepsText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FY28_AOP_Next_Steps.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function saveOne(index: number): Promise<boolean> {
    const init = result?.initiatives?.[index];
    if (!init) return false;
    if (saveStates[index] === 'saved') return true;
    setSaveStates((s) => ({ ...s, [index]: 'saving' }));
    setSaveErrors((s) => ({ ...s, [index]: '' }));
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(init.fields)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Save failed.');
      setSavedIds((s) => ({ ...s, [index]: String(data?.id ?? '') }));
      setSaveStates((s) => ({ ...s, [index]: 'saved' }));
      return true;
    } catch (e: any) {
      setSaveErrors((s) => ({ ...s, [index]: e?.message ?? 'Save failed.' }));
      setSaveStates((s) => ({ ...s, [index]: 'error' }));
      return false;
    }
  }

  async function saveSelected() {
    const indices = (result?.initiatives ?? [])
      .map((_, i) => i)
      .filter((i) => selected[i] && saveStates[i] !== 'saved');
    for (const i of indices) {
      // sequential to stay within SharePoint connection limits
      await saveOne(i);
    }
  }

  const initiatives = result?.initiatives ?? [];
  const selectedCount = initiatives.filter((_, i) => selected[i]).length;
  const savableSelected = initiatives.filter((_, i) => selected[i] && saveStates[i] !== 'saved').length;
  const allSelected = initiatives.length > 0 && initiatives.every((_, i) => selected[i]);
  const bulkSaving = initiatives.some((_, i) => selected[i] && saveStates[i] === 'saving');

  function toggleAll() {
    if (allSelected) {
      setSelected({});
    } else {
      const next: Record<number, boolean> = {};
      initiatives.forEach((_, i) => { next[i] = true; });
      setSelected(next);
    }
  }

  function onFilePicked(f: File | null) {
    setFile(f);
    resetResults();
    setParseError(null);
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Import from Transcript</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload or paste a transcript from an IT owner &amp; SVP conversation. We&apos;ll extract the recommended
          FY28 initiatives, summarize the discussion, and list the next steps &mdash; then you can save each as a draft submission.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        {/* Mode toggle */}
        <div className="inline-flex rounded-lg border border-border p-1 mb-4 bg-muted/40">
          <button
            onClick={() => setMode('upload')}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'upload' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <FileUp className="w-4 h-4" /> Upload file
          </button>
          <button
            onClick={() => setMode('paste')}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              mode === 'paste' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <Type className="w-4 h-4" /> Paste text
          </button>
        </div>

        {mode === 'upload' ? (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFilePicked(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
                dragOver ? 'border-[color:var(--accent-teal-muted)] bg-[color:var(--accent-teal)]/5' : 'border-border hover:border-muted-foreground/40'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.vtt,.srt,.md,.csv,.docx,.pdf"
                className="hidden"
                onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
              />
              <UploadCloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="w-4 h-4" style={{ color: 'var(--accent-teal-muted)' }} />
                  <span className="font-medium">{file.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFilePicked(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop a transcript here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .txt, .vtt, .srt, .docx, and .pdf</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <textarea
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); resetResults(); setParseError(null); }}
            placeholder="Paste the full transcript here. Tip: facilitators often cue each initiative with 'Initiative 1: <title>'."
            className="w-full h-56 rounded-lg border border-input bg-background text-sm p-3 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Fields that aren&apos;t clearly answered are flagged <span className="font-medium">NEEDS FOLLOW-UP</span> &mdash; nothing is invented.
          </p>
          <Button onClick={handleParse} disabled={!canParse || parsing} loading={parsing}>
            {!parsing && <Sparkles className="w-4 h-4 mr-2" />}
            {parsing ? 'Analyzing transcript…' : 'Parse Transcript'}
          </Button>
        </div>
      </div>

      {parseError && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          {result.summary && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-5 h-5" style={{ color: 'var(--accent-teal-muted)' }} />
                <h3 className="text-lg font-semibold">Conversation Summary</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{result.summary}</p>
            </div>
          )}

          {/* Next steps */}
          {result.nextSteps?.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5" style={{ color: 'var(--accent-teal-muted)' }} />
                  <h3 className="text-lg font-semibold">Next Steps</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={copyNextSteps}>
                    {copiedSteps ? <Check className="w-4 h-4 mr-1.5 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                    {copiedSteps ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={emailNextSteps}>
                    <Mail className="w-4 h-4 mr-1.5" /> Email to me
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadNextSteps}>
                    <Download className="w-4 h-4 mr-1.5" /> Download
                  </Button>
                </div>
              </div>
              <ul className="space-y-2">
                {result.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-teal-muted)' }} />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Initiatives toolbar */}
          {initiatives.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">
                    Recommended Initiatives <span className="text-muted-foreground font-normal">({initiatives.length})</span>
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="This parsed draft is saved in your browser — you can switch tabs or refresh and it will still be here.">
                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Auto-saved in your browser
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded border-input accent-[color:var(--accent-teal-muted)]" />
                    Select all
                  </label>
                  <Button onClick={saveSelected} disabled={savableSelected === 0 || bulkSaving} loading={bulkSaving} size="sm">
                    {!bulkSaving && <Save className="w-4 h-4 mr-2" />}
                    Save selected{selectedCount > 0 ? ` (${savableSelected})` : ''}
                  </Button>
                  <Button onClick={clearDraft} variant="outline" size="sm" title="Discard this parsed draft from your browser">
                    <X className="w-4 h-4 mr-1.5" /> Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {initiatives.map((init, i) => {
                  const state = saveStates[i] ?? 'idle';
                  const fields = init.fields ?? {};
                  const missingCount = FIELD_ORDER.filter((k) => isMissing(fields[k])).length;
                  const isOpen = expanded[i];
                  const complete = (init.status ?? '').toUpperCase() === 'COMPLETE';
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
                      {/* Card header */}
                      <div className="flex items-start gap-3 p-4">
                        <input
                          type="checkbox"
                          checked={!!selected[i]}
                          onChange={(e) => setSelected((s) => ({ ...s, [i]: e.target.checked }))}
                          className="mt-1 w-4 h-4 rounded border-input accent-[color:var(--accent-teal-muted)]"
                          disabled={state === 'saved'}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {fields.projectTitle && fields.projectTitle !== NEEDS ? fields.projectTitle : (init.title || `Initiative ${i + 1}`)}
                            </span>
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                              complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                              {complete ? 'Complete' : 'Needs follow-up'}
                            </span>
                            {init.segmentationUncertain && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Segmentation uncertain</span>
                            )}
                          </div>
                          {init.summary && <p className="text-sm text-muted-foreground mt-1">{init.summary}</p>}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {fields.functionalArea && fields.functionalArea !== NEEDS && <span>{fields.functionalArea}</span>}
                            {fields.initiativeType && fields.initiativeType !== NEEDS && <span>• {fields.initiativeType}</span>}
                            {missingCount > 0 && <span className="text-amber-700">• {missingCount} field{missingCount === 1 ? '' : 's'} need follow-up</span>}
                          </div>
                        </div>

                        {/* Save action */}
                        <div className="flex flex-col items-end gap-1">
                          {state === 'saved' ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-sm text-emerald-700 font-medium">
                                <CheckCircle2 className="w-4 h-4" /> Saved
                              </span>
                              {savedIds[i] && (
                                <Link href={`/dashboard/submission/${savedIds[i]}`} className="text-xs underline" style={{ color: 'var(--accent-teal-muted)' }}>
                                  View
                                </Link>
                              )}
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => saveOne(i)} disabled={state === 'saving'} loading={state === 'saving'}>
                              {state !== 'saving' && <Save className="w-4 h-4 mr-2" />}
                              Save
                            </Button>
                          )}
                          <button
                            onClick={() => setExpanded((s) => ({ ...s, [i]: !s[i] }))}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {isOpen ? <>Hide fields <ChevronUp className="w-3 h-3" /></> : <>View fields <ChevronDown className="w-3 h-3" /></>}
                          </button>
                        </div>
                      </div>

                      {saveErrors[i] && (
                        <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-xs">
                          {saveErrors[i]}
                        </div>
                      )}

                      {/* Expanded field detail */}
                      {isOpen && (
                        <div className="border-t border-border bg-muted/20 px-4 py-4">
                          <div className="flex items-center gap-2 mb-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Review &amp; edit fields before saving. Choice fields use the official FY28 AOP values.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            {FIELD_META.map((m) => {
                              const k = m.key;
                              const missing = isMissing(fields[k]);
                              return (
                                <div key={k} className={cn('flex flex-col gap-1', m.type === 'textarea' ? 'sm:col-span-2' : '')}>
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {m.label}
                                    {missing && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">needs follow-up</span>
                                    )}
                                  </label>
                                  <FieldEditor
                                    meta={m}
                                    value={fields[k]}
                                    onChange={(raw) => updateField(i, k, raw)}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {init.followUps && init.followUps.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Follow-up needed</p>
                              <div className="flex flex-wrap gap-2">
                                {init.followUps.map((f, fi) => (
                                  <span key={fi} className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{f}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {init.confidenceNotes && init.confidenceNotes.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Review notes</p>
                              <ul className="space-y-1">
                                {init.confidenceNotes.map((n, ni) => (
                                  <li key={ni} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />{n}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Saved initiatives are created as draft submissions with status <span className="font-medium">Pending Review</span>.
                Open each one to complete any fields marked NEEDS FOLLOW-UP before final submission.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
