'use client';

import { useState } from 'react';
import type { NoticePopup } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { getPopupState, makeId } from '@/lib/site-config';
import { formatISTDateTime, fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import {
  AdminPageHeader,
  ConfirmDialog,
  Field,
  Modal,
  Panel,
  Spinner,
  StatusPill,
  Toggle,
} from '../ui';
import { MultiPills } from '../ListEditors';
import { SettingsPublishBar } from '../SettingsPublishBar';

const FREQUENCIES: Array<{ value: NoticePopup['frequency']; label: string; description: string }> = [
  { value: 'once_session', label: 'Once per session', description: 'Shown once until the browser tab is closed.' },
  { value: 'once_day', label: 'Once per day', description: 'Resets every calendar day.' },
  { value: 'once_user', label: 'Once per device', description: 'Never shown again after dismissal on this browser.' },
  { value: 'always', label: 'Every visit', description: 'Use sparingly — best for urgent notices.' },
];

const PLACEMENTS: Array<{ value: NoticePopup['placements'][number]; label: string }> = [
  { value: 'home', label: 'Student home' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'login', label: 'Login' },
  { value: 'all', label: 'Every placement' },
];

const STATE_TONE = { active: 'success', scheduled: 'info', expired: 'warning', paused: 'neutral' } as const;

function createPopup(): NoticePopup {
  return {
    id: makeId('popup'),
    title: 'Important update',
    body: '',
    imageUrl: '',
    ctaLabel: '',
    ctaHref: '',
    active: true,
    frequency: 'once_day',
    placements: ['home'],
    audience: 'all',
    startAt: '',
    endAt: '',
    priority: 0,
    dismissible: true,
    updatedAt: new Date().toISOString(),
  };
}

export function PopupsSection() {
  const workspace = useSettingWorkspace('popups');
  const { draft, update, loading } = workspace;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const items = draft.items;
  const editing = items.find((item) => item.id === editingId) || null;
  const preview = items.find((item) => item.id === previewId) || null;

  function patchPopup(id: string, patch: Partial<NoticePopup>) {
    update({
      items: items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      ),
    });
  }

  function addPopup() {
    const popup = createPopup();
    update({ items: [...items, popup] });
    setEditingId(popup.id);
  }

  if (loading) return <Spinner label="Loading popups…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Design studio"
        title="Popup & Notice Manager"
        description="Publish targeted popups with real frequency control. Frequency is stored on the student's browser — no fabricated impressions or click analytics."
        meta={
          <>
            <StatusPill tone="brand">{items.length} popups</StatusPill>
            <StatusPill tone="success">{items.filter((item) => getPopupState(item) === 'active').length} active</StatusPill>
          </>
        }
        actions={
          <button type="button" onClick={addPopup} className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white">
            + New popup
          </button>
        }
      />

      <SettingsPublishBar
        dirty={workspace.dirty}
        publishedAt={workspace.publishedAt}
        updatedAt={workspace.updatedAt}
        saving={workspace.saving}
        publishing={workspace.publishing}
        resetting={workspace.resetting}
        error={workspace.error}
        validationErrors={workspace.validationErrors}
        status={workspace.status}
        onSave={() => void workspace.saveDraft()}
        onPublish={() => void workspace.publish()}
        onReset={() => void workspace.reset()}
        onReload={() => void workspace.reload()}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] mt-5 items-start">
        <Panel title="Popup library" description="Highest priority eligible popup is shown to each student.">
          <div className="space-y-3">
            {items.map((popup) => {
              const state = getPopupState(popup);
              return (
                <div key={popup.id} className="rounded-xl border border-ink-200 p-3.5 bg-[var(--ec-surface)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{popup.title}</p>
                      <p className="text-[11px] text-ink-500 line-clamp-2 mt-0.5">{popup.body || 'No body text'}</p>
                    </div>
                    <StatusPill tone={STATE_TONE[state]}>{state}</StatusPill>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <StatusPill tone="neutral">{FREQUENCIES.find((freq) => freq.value === popup.frequency)?.label}</StatusPill>
                    {popup.placements.map((placement) => (
                      <span key={placement} className="text-[10px] rounded-full bg-ink-100 text-ink-600 px-2 py-0.5">
                        {PLACEMENTS.find((item) => item.value === placement)?.label || placement}
                      </span>
                    ))}
                    {popup.audience !== 'all' && <StatusPill tone="info">{popup.audience}</StatusPill>}
                    {popup.priority !== 0 && <StatusPill tone="brand">P{popup.priority}</StatusPill>}
                  </div>
                  <p className="text-[10px] text-ink-400 mt-2">
                    {popup.startAt || popup.endAt
                      ? `${popup.startAt ? formatISTDateTime(popup.startAt) : 'No start'} → ${popup.endAt ? formatISTDateTime(popup.endAt) : 'No end'}`
                      : 'No schedule window'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <button type="button" onClick={() => setEditingId(popup.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold bg-ink-900 text-white">Edit</button>
                    <button type="button" onClick={() => setPreviewId(popup.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-ink-200">Preview</button>
                    <button
                      type="button"
                      onClick={() => patchPopup(popup.id, { active: !popup.active })}
                      className={`ec-btn px-2.5 py-1.5 text-[11px] font-semibold border ${popup.active ? 'border-amber-200 text-amber-800' : 'border-emerald-200 text-emerald-700'}`}
                    >
                      {popup.active ? 'Pause' : 'Activate'}
                    </button>
                    <button type="button" onClick={() => setDeleteId(popup.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-red-200 text-red-700">Delete</button>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="text-center py-10 border border-dashed border-ink-200 rounded-xl">
                <p className="text-sm font-semibold">No popups yet</p>
                <p className="text-xs text-ink-500 mt-1">Create a notice for an upcoming event or important change.</p>
                <button type="button" onClick={addPopup} className="mt-3 ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">+ New popup</button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Frequency behaviour" description="How often a student sees each popup.">
          <div className="space-y-2.5">
            {FREQUENCIES.map((frequency) => (
              <div key={frequency.value} className="rounded-lg border border-ink-100 p-2.5">
                <p className="text-xs font-semibold">{frequency.label}</p>
                <p className="text-[10px] text-ink-500 mt-0.5">{frequency.description}</p>
              </div>
            ))}
            <p className="text-[10px] text-ink-500 pt-1">
              Tracking keys are stored locally as <code>ec_popup_seen_&lt;id&gt;</code>. Clearing browser storage will
              show dismissed popups again. No personally identifiable analytics are collected.
            </p>
          </div>
        </Panel>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title={editing ? `Edit popup · ${editing.title}` : 'Popup'}
        description="Popups render only when active, in schedule, matching the student audience and allowed by the frequency rule."
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setEditingId(null)} className="ec-btn px-3 py-2 text-xs font-semibold border border-ink-200">Close</button>
            <button type="button" onClick={() => setEditingId(null)} className="ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">Done</button>
          </>
        }
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Title" required>
              <input className="ec-field" value={editing.title} onChange={(event) => patchPopup(editing.id, { title: event.target.value })} />
            </Field>
            <Field label="Image URL">
              <input className="ec-field" value={editing.imageUrl} placeholder="https://…" onChange={(event) => patchPopup(editing.id, { imageUrl: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Body" required>
                <textarea className="ec-field" rows={4} value={editing.body} onChange={(event) => patchPopup(editing.id, { body: event.target.value })} />
              </Field>
            </div>
            <Field label="CTA label">
              <input className="ec-field" value={editing.ctaLabel} onChange={(event) => patchPopup(editing.id, { ctaLabel: event.target.value })} />
            </Field>
            <Field label="CTA link">
              <input className="ec-field" value={editing.ctaHref} placeholder="/events" onChange={(event) => patchPopup(editing.id, { ctaHref: event.target.value })} />
            </Field>
            <Field label="Frequency">
              <select className="ec-field" value={editing.frequency} onChange={(event) => patchPopup(editing.id, { frequency: event.target.value as NoticePopup['frequency'] })}>
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency.value} value={frequency.value}>{frequency.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <input type="number" className="ec-field" value={editing.priority} onChange={(event) => patchPopup(editing.id, { priority: Number(event.target.value) })} />
            </Field>
            <Field label="Audience">
              <select className="ec-field" value={editing.audience} onChange={(event) => patchPopup(editing.id, { audience: event.target.value as NoticePopup['audience'] })}>
                <option value="all">All students</option>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="JEE-11">JEE · Class 11</option>
                <option value="JEE-12">JEE · Class 12</option>
                <option value="NEET-11">NEET · Class 11</option>
                <option value="NEET-12">NEET · Class 12</option>
              </select>
            </Field>
            <Field label="Starts at (IST)">
              <input type="datetime-local" className="ec-field" value={toISTDateTimeLocalInput(editing.startAt)} onChange={(event) => patchPopup(editing.id, { startAt: fromISTDateTimeLocalInput(event.target.value) || '' })} />
            </Field>
            <Field label="Ends at (IST)">
              <input type="datetime-local" className="ec-field" value={toISTDateTimeLocalInput(editing.endAt)} onChange={(event) => patchPopup(editing.id, { endAt: fromISTDateTimeLocalInput(event.target.value) || '' })} />
            </Field>
            <div className="sm:col-span-2">
              <MultiPills label="Placements" value={editing.placements} onChange={(placements) => patchPopup(editing.id, { placements })} options={PLACEMENTS} />
            </div>
            <Toggle checked={editing.active} onChange={(active) => patchPopup(editing.id, { active })} label="Active" description="Paused popups are never shown." />
            <Toggle checked={editing.dismissible} onChange={(dismissible) => patchPopup(editing.id, { dismissible })} label="Dismissible" description="Students can close the popup." />
          </div>
        )}
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreviewId(null)} title="Popup preview" size="md">
        {preview && (
          <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
            <div className="ec-card max-w-md mx-auto p-5 relative">
              {preview.dismissible && <button type="button" className="absolute top-3 right-3 text-ink-400" aria-label="Close preview">✕</button>}
              {isSafeHttpUrl(preview.imageUrl) && <img src={preview.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl mb-3" />}
              <p className="text-base font-bold">{preview.title}</p>
              <p className="text-sm text-ink-500 mt-1 whitespace-pre-line">{preview.body}</p>
              {preview.ctaLabel && (isValidInternalDeepLink(preview.ctaHref) || isSafeHttpUrl(preview.ctaHref)) && (
                <div className="mt-4 inline-flex px-3.5 py-2 text-xs font-bold bg-brand-600 text-white rounded-button">
                  {preview.ctaLabel}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this popup?"
        confirmLabel="Delete popup"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) update({ items: items.filter((item) => item.id !== deleteId) });
          setDeleteId(null);
        }}
      />
    </div>
  );
}
