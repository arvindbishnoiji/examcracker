'use client';

import { useState } from 'react';
import type { Testimonial } from '@/types';
import { useSettingWorkspace } from '@/hooks/useSettingWorkspace';
import { makeId } from '@/lib/site-config';
import { isSafeHttpUrl } from '@/lib/validation';
import { AdminPageHeader, ConfirmDialog, Field, Modal, Panel, Spinner, StatusPill, Toggle } from '../ui';
import { SettingsPublishBar } from '../SettingsPublishBar';
import { ImageField } from '../ImageField';

function createTestimonial(order: number): Testimonial {
  return {
    id: makeId('testimonial'),
    name: '',
    exam: 'JEE',
    classLevel: '12',
    quote: '',
    avatarUrl: '',
    result: '',
    rating: 5,
    featured: false,
    active: true,
    order,
  };
}

export function TestimonialsSection() {
  const workspace = useSettingWorkspace('testimonials');
  const { draft, update, loading } = workspace;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const items = draft.items;
  const editing = items.find((item) => item.id === editingId) || null;

  function patch(id: string, patchValue: Partial<Testimonial>) {
    update({ items: items.map((item) => (item.id === id ? { ...item, ...patchValue } : item)) });
  }

  function add() {
    const item = createTestimonial(items.length);
    update({ items: [...items, item] });
    setEditingId(item.id);
  }

  if (loading) return <Spinner label="Loading testimonials…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Website settings"
        title="Testimonials & Highlights"
        description="Curate genuine student stories. They appear on the login page and in the homepage testimonial section only when active and featured as configured."
        meta={
          <>
            <StatusPill tone="brand">{items.length} stories</StatusPill>
            <StatusPill tone="success">{items.filter((item) => item.active).length} active</StatusPill>
          </>
        }
        actions={
          <button type="button" onClick={add} className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white">
            + Add testimonial
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
        <Panel title="Stories" description="Ordered by the order field. Inactive stories are hidden everywhere.">
          <div className="grid sm:grid-cols-2 gap-3">
            {items
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <div key={item.id} className={`rounded-xl border p-4 ${item.active ? 'border-ink-200' : 'border-dashed border-ink-200 opacity-60'}`}>
                  <div className="flex items-start gap-2.5">
                    {item.avatarUrl && isSafeHttpUrl(item.avatarUrl) ? (
                      <img src={item.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-bold">
                        {(item.name || '?').slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{item.name || 'Unnamed student'}</p>
                      <p className="text-[10px] text-ink-500">
                        {item.exam} · Class {item.classLevel} {item.result ? `· ${item.result}` : ''}
                      </p>
                    </div>
                    {item.featured && <StatusPill tone="brand">Featured</StatusPill>}
                  </div>
                  <p className="text-[11px] text-ink-600 mt-2 line-clamp-3">“{item.quote || 'No quote yet'}”</p>
                  <div className="text-[11px] text-amber-500 mt-1">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <button type="button" onClick={() => setEditingId(item.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold bg-ink-900 text-white">Edit</button>
                    <button type="button" onClick={() => patch(item.id, { active: !item.active })} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-ink-200">{item.active ? 'Hide' : 'Show'}</button>
                    <button type="button" onClick={() => patch(item.id, { featured: !item.featured })} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-ink-200">{item.featured ? 'Unfeature' : 'Feature'}</button>
                    <button type="button" onClick={() => setDeleteId(item.id)} className="ec-btn px-2.5 py-1.5 text-[11px] font-semibold border border-red-200 text-red-700">Delete</button>
                  </div>
                </div>
              ))}
            {items.length === 0 && (
              <div className="sm:col-span-2 text-center py-10 border border-dashed border-ink-200 rounded-xl">
                <p className="text-sm font-semibold">No testimonials yet</p>
                <p className="text-xs text-ink-500 mt-1">Only add stories you can verify. No invented results.</p>
                <button type="button" onClick={add} className="mt-3 ec-btn px-3 py-2 text-xs font-semibold bg-brand-600 text-white">+ Add testimonial</button>
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Section copy" description="Used by the homepage testimonial section.">
            <div className="space-y-3">
              <Field label="Section title">
                <input className="ec-field" value={draft.title} onChange={(event) => update({ title: event.target.value })} />
              </Field>
              <Field label="Section subtitle">
                <input className="ec-field" value={draft.subtitle} onChange={(event) => update({ subtitle: event.target.value })} />
              </Field>
            </div>
          </Panel>
          <Panel title="Homepage visibility">
            <p className="text-[11px] text-ink-500">
              The homepage section is controlled in the Home Page Builder. This manager only controls the stories
              themselves. The login page shows the first two active stories when “Show featured testimonials” is enabled
              in the Login Page Designer.
            </p>
          </Panel>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title={editing ? `Edit testimonial · ${editing.name || 'Student'}` : 'Testimonial'}
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
            <Field label="Student name" required>
              <input className="ec-field" value={editing.name} onChange={(event) => patch(editing.id, { name: event.target.value })} />
            </Field>
            <Field label="Result / highlight">
              <input className="ec-field" value={editing.result} placeholder="JEE Main 99.2 percentile" onChange={(event) => patch(editing.id, { result: event.target.value })} />
            </Field>
            <Field label="Exam">
              <select className="ec-field" value={editing.exam} onChange={(event) => patch(editing.id, { exam: event.target.value as Testimonial['exam'] })}>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
              </select>
            </Field>
            <Field label="Class">
              <select className="ec-field" value={editing.classLevel} onChange={(event) => patch(editing.id, { classLevel: event.target.value as Testimonial['classLevel'] })}>
                <option value="11">Class 11</option>
                <option value="12">Class 12</option>
                <option value="Dropper">Dropper</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Quote" required>
                <textarea className="ec-field" rows={4} value={editing.quote} onChange={(event) => patch(editing.id, { quote: event.target.value })} />
              </Field>
            </div>
            <ImageField
              label="Student Avatar Photo (URL or Google Drive)"
              help="Paste an image link OR upload photo to Google Drive (with square crop)."
              context="testimonial_avatar"
              preferSquareCrop
              value={editing.avatarUrl}
              onChange={(avatarUrl) => patch(editing.id, { avatarUrl })}
            />
            <Field label="Rating">
              <select className="ec-field" value={editing.rating} onChange={(event) => patch(editing.id, { rating: Number(event.target.value) })}>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>{rating} star{rating === 1 ? '' : 's'}</option>
                ))}
              </select>
            </Field>
            <Field label="Order">
              <input type="number" className="ec-field" value={editing.order} onChange={(event) => patch(editing.id, { order: Number(event.target.value) })} />
            </Field>
            <div className="space-y-2">
              <Toggle checked={editing.active} onChange={(active) => patch(editing.id, { active })} label="Active" />
              <Toggle checked={editing.featured} onChange={(featured) => patch(editing.id, { featured })} label="Featured" />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete this testimonial?"
        confirmLabel="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) update({ items: items.filter((item) => item.id !== deleteId) });
          setDeleteId(null);
        }}
      />
    </div>
  );
}
