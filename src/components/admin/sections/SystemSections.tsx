'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SiteSettingKey } from '@/types';
import { getAdminSiteSettings, saveAdminSiteSettingDraft } from '@/lib/api';
import { ADMIN_SECTIONS, adminSectionHref, findAdminSection } from '@/lib/admin-sections';
import { DEFAULT_ADMIN_PREFERENCES, readAdminPreferences, writeAdminPreferences, type AdminPreferences } from '@/lib/admin-prefs';
import { SITE_SETTING_KEYS } from '@/lib/site-config';
import { validateSettingValue } from '@/lib/site-validation';
import { useToast } from '@/hooks/useToast';
import { AdminPageHeader, Banner, ConfirmDialog, Field, Panel, Spinner, StatusPill, Toggle } from '../ui';

export function PreferencesSection() {
  const { push } = useToast();
  const [prefs, setPrefs] = useState<AdminPreferences>(DEFAULT_ADMIN_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(readAdminPreferences());
    setLoaded(true);
  }, []);

  function apply(next: AdminPreferences) {
    setPrefs(next);
    writeAdminPreferences(next);
  }

  if (!loaded) return <Spinner label="Loading preferences…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="System"
        title="Admin Preferences"
        description="Browser-local preferences for this admin console. They apply instantly and are never published to students."
        meta={<StatusPill tone="neutral">Stored in this browser only</StatusPill>}
      />
      <div className="grid gap-4 xl:grid-cols-2 items-start">
        <Panel title="Workspace" description="Layout preferences applied by the admin shell.">
          <div className="space-y-3">
            <Toggle
              checked={prefs.sidebarCollapsed}
              onChange={(sidebarCollapsed) => apply({ ...prefs, sidebarCollapsed })}
              label="Start with a collapsed sidebar"
              description="Icons only until you expand it. Also toggled from the sidebar control."
            />
            <Toggle
              checked={prefs.compactTables}
              onChange={(compactTables) => apply({ ...prefs, compactTables })}
              label="Compact density"
              description="Reduces base text size across admin tools."
            />
            <Toggle
              checked={prefs.reduceAdminMotion}
              onChange={(reduceAdminMotion) => apply({ ...prefs, reduceAdminMotion })}
              label="Reduce motion"
              description="Disables transitions and animations in the admin console."
            />
            <Field label="Rows per page" help="Used by student and content tables.">
              <select
                className="ec-field"
                value={prefs.pageSize}
                onChange={(event) => apply({ ...prefs, pageSize: Number(event.target.value) })}
              >
                {[12, 24, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} rows</option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Default workspace" description="Pinned at the top of the Overview for one-click access.">
            <select
              className="ec-field"
              value={prefs.defaultSection}
              onChange={(event) => apply({ ...prefs, defaultSection: event.target.value })}
            >
              {ADMIN_SECTIONS.filter((section) => section.slug !== 'overview').map((section) => (
                <option key={section.slug} value={section.slug}>
                  {section.group} · {section.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-500 mt-2">
              Current: <strong className="text-ink-700">{findAdminSection(prefs.defaultSection)?.label || 'Overview'}</strong>
            </p>
            <a
              href={adminSectionHref(prefs.defaultSection || 'overview')}
              className="mt-2 inline-flex ec-btn px-3 py-2 text-xs font-semibold border border-ink-200"
            >
              Open default workspace →
            </a>
          </Panel>

          <Panel title="Reset">
            <button
              type="button"
              onClick={() => {
                apply({ ...DEFAULT_ADMIN_PREFERENCES });
                push('Admin preferences reset.', 'success');
              }}
              className="ec-btn px-3 py-2 text-xs font-semibold border border-red-200 text-red-700"
            >
              Reset to defaults
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}

interface ImportReport {
  key: SiteSettingKey;
  ok: boolean;
  errors: string[];
  written?: boolean;
}

export function ImportExportSection() {
  const { push } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getAdminSiteSettings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [reports, setReports] = useState<ImportReport[]>([]);
  const [confirmImport, setConfirmImport] = useState<Array<{ key: SiteSettingKey; value: unknown; report: ImportReport }>>([]);

  useEffect(() => {
    let cancelled = false;
    getAdminSiteSettings()
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const backup = useMemo(() => {
    const settings: Record<string, unknown> = {};
    for (const row of rows || []) {
      settings[row.key] = { published: row.published, draft: row.draft, publishedAt: row.published_at };
    }
    return {
      exportedAt: new Date().toISOString(),
      schema: 'exam-cracker-site-settings@1',
      settings,
    };
  }, [rows]);

  function download() {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `exam-cracker-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setReports([]);
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      push('That file is not valid JSON.', 'error');
      return;
    }
    const settings = (parsed as { settings?: Record<string, { draft?: unknown } | unknown> }).settings;
    if (!settings || typeof settings !== 'object') {
      push('Expected an export with a "settings" object.', 'error');
      return;
    }
    const nextReports: ImportReport[] = [];
    const pending: Array<{ key: SiteSettingKey; value: unknown; report: ImportReport }> = [];
    for (const key of SITE_SETTING_KEYS) {
      if (!(key in settings)) continue;
      const entry = settings[key] as { draft?: unknown } | unknown;
      const value = entry && typeof entry === 'object' && 'draft' in (entry as object)
        ? (entry as { draft?: unknown }).draft
        : entry;
      if (!value) continue;
      const result = validateSettingValue(key, value);
      const report: ImportReport = { key, ok: result.ok, errors: result.errors };
      nextReports.push(report);
      if (result.ok) pending.push({ key, value, report });
    }
    setReports(nextReports);
    if (pending.length === 0) {
      push('Nothing importable was found in that file.', 'error');
      return;
    }
    setConfirmImport(pending);
  }

  async function runImport() {
    setImporting(true);
    for (const item of confirmImport) {
      try {
        await saveAdminSiteSettingDraft(item.key, item.value);
        item.report.written = true;
      } catch (err) {
        item.report.ok = false;
        item.report.errors = [err instanceof Error ? err.message : 'Write failed'];
      }
    }
    setReports([...reports]);
    setImporting(false);
    setConfirmImport([]);
    push('Import complete. Open each section and publish when ready.', 'success');
  }

  if (loading) return <Spinner label="Loading backup…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="System"
        title="Import / Export"
        description="Download a complete backup of published and draft settings, or restore a validated export as drafts. Nothing is published automatically."
        meta={<StatusPill tone="brand">{rows?.length || 0} setting keys stored</StatusPill>}
        actions={
          <>
            <button type="button" onClick={download} disabled={!rows?.length} className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white disabled:opacity-50">
              Export JSON
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 bg-white">
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
          </>
        }
      />

      {error && <Banner tone="danger" title="Backup unavailable">{error}</Banner>}

      <div className="grid gap-4 xl:grid-cols-2 mt-4 items-start">
        <Panel title="What the export contains" description="Safe to commit to a private repo or store in a vault.">
          <ul className="text-[11px] text-ink-600 space-y-1.5 list-disc pl-4">
            <li>Every stored setting key with published and draft payloads.</li>
            <li>Publish timestamps so you can see how fresh each surface is.</li>
            <li>No Firebase tokens, student emails, UIDs or attempt data.</li>
            <li>Content (lectures, tests, events) lives in Cloudflare D1; PDFs and profile photos live in Google Drive.</li>
          </ul>
          <button type="button" onClick={download} disabled={!rows?.length} className="mt-3 ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 disabled:opacity-50">
            Download backup
          </button>
        </Panel>

        <Panel title="Import rules" description="Validation runs before any write.">
          <ul className="text-[11px] text-ink-600 space-y-1.5 list-disc pl-4">
            <li>Unknown keys are ignored.</li>
            <li>Each key is validated with the same rules used by the live editor.</li>
            <li>Valid keys are written as <strong>drafts</strong> — publishing stays manual.</li>
            <li>Invalid keys are reported and never written.</li>
          </ul>
          {reports.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {reports.map((report) => (
                <div key={report.key} className="rounded-lg border border-ink-200 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold">{report.key}</span>
                    <StatusPill tone={report.written ? 'success' : report.ok ? 'info' : 'danger'}>
                      {report.written ? 'draft written' : report.ok ? 'valid' : 'invalid'}
                    </StatusPill>
                  </div>
                  {report.errors.length > 0 && (
                    <ul className="mt-1 text-[10px] text-red-600 list-disc pl-4 space-y-0.5">
                      {report.errors.slice(0, 5).map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmImport.length > 0}
        title={`Write ${confirmImport.length} drafts?`}
        description="Valid settings will be saved as drafts. Publish each section to make them live for students."
        confirmLabel={importing ? 'Writing…' : 'Write drafts'}
        onCancel={() => setConfirmImport([])}
        onConfirm={() => {
          if (!importing) void runImport();
        }}
      />
    </div>
  );
}
