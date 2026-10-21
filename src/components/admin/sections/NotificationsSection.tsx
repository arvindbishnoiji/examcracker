'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { StudentProfile } from '@/types';
import { getAdminStudents } from '@/lib/api';
import { sendAdminNotification, sendAdminNotificationBatch } from '@/lib/app-data';
import { isValidInternalDeepLink } from '@/lib/validation';
import { useToast } from '@/hooks/useToast';
import { AdminPageHeader, Banner, ConfirmDialog, Field, Panel, SearchInput, Spinner, StatCard, StatusPill } from '../ui';

const NOTIFICATION_TYPES = [
  { value: 'info', label: 'General' },
  { value: 'test', label: 'Test' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'goal', label: 'Goal' },
  { value: 'chat', label: 'Chat' },
] as const;

export function NotificationsSection() {
  const { push } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<'all' | 'JEE' | 'NEET' | 'class'>('all');
  const [classLevel, setClassLevel] = useState<'11' | '12'>('12');
  const [singleUid, setSingleUid] = useState('');
  const [form, setForm] = useState({ title: '', body: '', deepLink: '', type: 'info' as (typeof NOTIFICATION_TYPES)[number]['value'] });
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [validation, setValidation] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAdminStudents()
      .then((items) => {
        if (!cancelled) setStudents(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load students.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recipients = useMemo(() => {
    if (singleUid) return students.filter((student) => student.firebase_uid === singleUid);
    if (target === 'JEE' || target === 'NEET') return students.filter((student) => student.exam === target);
    if (target === 'class') return students.filter((student) => student.class_level === classLevel);
    return students;
  }, [students, target, classLevel, singleUid]);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students.filter((student) => `${student.display_name} ${student.email || ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [students, query]);

  function validate() {
    const errors: string[] = [];
    if (!form.title.trim()) errors.push('Add a notification title.');
    if (form.title.trim().length > 120) errors.push('Keep the title under 120 characters.');
    if (!form.body.trim()) errors.push('Add a message body.');
    if (form.deepLink && !isValidInternalDeepLink(form.deepLink)) errors.push('Deep links must be an internal route such as /tests.');
    if (recipients.length === 0) errors.push('No students match this audience.');
    setValidation(errors);
    return errors.length === 0;
  }

  async function send() {
    if (!validate()) return;
    setSending(true);
    setResult(null);
    try {
      if (singleUid) {
        await sendAdminNotification(singleUid, {
          title: form.title,
          body: form.body,
          deepLink: form.deepLink || null,
          type: form.type,
        });
        setResult({ sent: 1, failed: 0 });
      } else {
        const outcome = await sendAdminNotificationBatch(
          recipients.map((student) => student.firebase_uid),
          { title: form.title, body: form.body, deepLink: form.deepLink || null, type: form.type }
        );
        setResult({ sent: outcome.sent, failed: outcome.failed.length });
      }
      push('Notification delivered to the in-app inbox.', 'success');
      setForm({ ...form, title: '', body: '', deepLink: '' });
    } catch (err) {
      push(err instanceof Error ? err.message : 'Delivery failed.', 'error');
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  if (loading) return <Spinner label="Loading students…" />;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Communication"
        title="Notifications"
        description="Deliver real in-app notifications to the student inbox. Every write is an individual D1 row the student app reads."
        meta={
          <>
            <StatusPill tone="brand">{students.length} reachable students</StatusPill>
            <StatusPill tone="neutral">No email or push invented</StatusPill>
          </>
        }
      />
      {error && <Banner tone="danger" title="Student list unavailable">{error}</Banner>}

      <div className="grid gap-3 sm:grid-cols-3 mt-4">
        <StatCard label="Audience" value={recipients.length} hint={singleUid ? 'Selected student' : 'Matching current filters'} tone="brand" />
        <StatCard label="Channel" value="In-app" hint="D1 notification inbox" tone="info" />
        <StatCard label="Delivery" value="Batched" hint="400 writes per batch" tone="success" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start mt-4">
        <Panel title="Compose notification">
          <div className="space-y-3">
            <Field label="Title" required>
              <input className="ec-field" maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Tomorrow's mock test moved to 7 PM" />
            </Field>
            <Field label="Message" required>
              <textarea className="ec-field" rows={4} maxLength={2000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Full details students should see in their inbox…" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Deep link" help="Internal route only, e.g. /tests.">
                <input className={`ec-field ${form.deepLink && !isValidInternalDeepLink(form.deepLink) ? '!border-red-300' : ''}`} value={form.deepLink} onChange={(event) => setForm({ ...form, deepLink: event.target.value })} placeholder="/events" />
              </Field>
              <Field label="Category">
                <select className="ec-field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })}>
                  {NOTIFICATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            {validation.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <ul className="text-[11px] text-red-700 list-disc pl-4 space-y-0.5">
                  {validation.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-ink-500">
                Delivering to <strong className="text-ink-700">{recipients.length}</strong> student{recipients.length === 1 ? '' : 's'}.
              </p>
              <button
                type="button"
                disabled={sending || recipients.length === 0}
                onClick={() => {
                  if (validate()) setConfirmOpen(true);
                }}
                className="ec-btn px-3.5 py-2 text-xs font-semibold bg-brand-600 text-white disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send notification'}
              </button>
            </div>
            {result && (
              <Banner tone={result.failed ? 'warning' : 'success'} title={result.failed ? 'Partially delivered' : 'Delivered'}>
                {result.sent} notification{result.sent === 1 ? '' : 's'} written to student inboxes
                {result.failed ? ` · ${result.failed} failed (check the Worker logs and retry).` : '.'}
              </Banner>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Audience" description="Filters are applied to the real student directory.">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'JEE', 'NEET', 'class'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setTarget(option); setSingleUid(''); }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${target === option && !singleUid ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-200 text-ink-600'}`}
                  >
                    {option === 'all' ? 'Everyone' : option === 'class' ? 'By class' : option}
                  </button>
                ))}
              </div>
              {target === 'class' && !singleUid && (
                <Field label="Class">
                  <select className="ec-field" value={classLevel} onChange={(event) => setClassLevel(event.target.value as '11' | '12')}>
                    <option value="11">Class 11</option>
                    <option value="12">Class 12</option>
                  </select>
                </Field>
              )}
              <Field label="Or target one student">
                <SearchInput value={query} onChange={setQuery} placeholder="Search by name or email…" />
              </Field>
              {filteredStudents.length > 0 && (
                <div className="space-y-1">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.firebase_uid}
                      type="button"
                      onClick={() => { setSingleUid(student.firebase_uid); setQuery(''); }}
                      className="w-full text-left rounded-lg border border-ink-200 px-2 py-1.5 text-[11px] hover:bg-ink-50"
                    >
                      {student.display_name || 'Unnamed'} <span className="text-ink-400">({student.exam} · {student.class_level})</span>
                    </button>
                  ))}
                </div>
              )}
              {singleUid && (
                <div className="rounded-lg bg-brand-50 border border-brand-100 p-2 text-[11px] text-brand-800 flex items-center justify-between gap-2">
                  <span>Single student: {students.find((student) => student.firebase_uid === singleUid)?.display_name || singleUid.slice(0, 8)}</span>
                  <button type="button" onClick={() => setSingleUid('')} className="font-semibold">Clear</button>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Where it appears">
            <p className="text-[11px] text-ink-500">
              Notifications are written to <code>users/&lt;uid&gt;/notifications</code> and appear instantly in the student
              notification inbox. The same inbox marks them read. Email and browser push are not configured, so this tool
              does not claim to send them.
            </p>
            <Link href="/admin/popups" className="mt-2 inline-flex text-[11px] font-semibold text-brand-700">
              Need a site-wide modal instead? Open Popup Manager →
            </Link>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Send to ${recipients.length} student${recipients.length === 1 ? '' : 's'}?`}
        description="This writes a notification document to each student's inbox. It cannot be recalled after delivery."
        confirmLabel={sending ? 'Sending…' : 'Send now'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (!sending) void send();
        }}
      />
    </div>
  );
}
