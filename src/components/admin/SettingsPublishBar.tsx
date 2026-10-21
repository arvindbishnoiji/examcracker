'use client';

import { useState } from 'react';
import { formatISTDateTime } from '@/lib/date';
import { Banner, ConfirmDialog, StatusPill } from './ui';

export function SettingsPublishBar({
  dirty,
  publishedAt,
  updatedAt,
  saving,
  publishing,
  resetting,
  error,
  validationErrors,
  status,
  onSave,
  onPublish,
  onReset,
  onReload,
  publishLabel = 'Publish to students',
}: {
  dirty: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  saving: boolean;
  publishing: boolean;
  resetting: boolean;
  error: string | null;
  validationErrors: string[];
  status: string | null;
  onSave: () => void;
  onPublish: () => void;
  onReset: () => void;
  onReload: () => void;
  publishLabel?: string;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const busy = saving || publishing || resetting;

  return (
    <div className="ec-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={dirty ? 'warning' : publishedAt ? 'success' : 'neutral'}>
            {dirty ? 'Unpublished changes' : publishedAt ? 'Published' : 'Using built-in defaults'}
          </StatusPill>
          {publishedAt && <span className="text-[11px] text-ink-500">Live since {formatISTDateTime(publishedAt)}</span>}
          {!publishedAt && !dirty && (
            <span className="text-[11px] text-ink-500">Nothing has been published yet.</span>
          )}
          {updatedAt && <span className="text-[11px] text-ink-500">Draft updated {formatISTDateTime(updatedAt)}</span>}
          {status && <StatusPill tone="info">{status}</StatusPill>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            disabled={busy}
            className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={busy}
            className="ec-btn px-3 py-2 text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Reset defaults
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy || !dirty}
            className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={busy}
            className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {publishing ? 'Publishing…' : publishLabel}
          </button>
        </div>
      </div>

      {error && <Banner tone="danger" title="Could not save">{error}</Banner>}
      {validationErrors.length > 0 && (
        <Banner tone="warning" title={`${validationErrors.length} validation ${validationErrors.length === 1 ? 'issue' : 'issues'}`}>
          <ul className="list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
            {validationErrors.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </Banner>
      )}
      <p className="text-[11px] text-ink-500">
        Drafts are private. Students only receive values after <strong>Publish</strong>, once the D1 migration and
        Edge Function in this repository are deployed.
      </p>

      <ConfirmDialog
        open={confirmReset}
        title="Reset this configuration?"
        description="The published values and the draft will be removed, and the built-in defaults will be used on the live site."
        confirmLabel="Reset to defaults"
        loading={resetting}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          onReset();
        }}
      />
    </div>
  );
}
