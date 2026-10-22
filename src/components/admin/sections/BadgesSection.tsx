'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, BadgeCheck, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { AdminPageHeader, Field, Panel, StatusPill } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { getAdminBadges, saveAdminBadge, awardAdminBadge, revokeAdminBadge, searchAdminStudents } from '@/lib/api';
import type { BadgeCategory, BadgeDefinition, BadgeRarity, BadgeAwardRecord } from '@/types';
import { useToast } from '@/hooks/useToast';

const CATEGORIES: Array<{ value: BadgeCategory; label: string }> = [
  { value: 'achievement', label: 'Achievement' }, { value: 'consistency', label: 'Consistency' },
  { value: 'test_performance', label: 'Test performance' }, { value: 'course_completion', label: 'Course completion' },
  { value: 'community', label: 'Community' }, { value: 'verified', label: 'Verified status' }, { value: 'custom', label: 'Custom' },
];
const RARITIES: BadgeRarity[] = ['standard', 'rare', 'epic', 'legendary'];
type Draft = Omit<BadgeDefinition, 'id' | 'active_awards'> & { id?: string; active: boolean; sort_order: number };
type StudentSearchResult = { firebase_uid: string; display_name: string; email: string | null; exam: string; class_level: string };
const EMPTY: Draft = { title: '', description: '', criteria: '', category: 'achievement', rarity: 'standard', image_url: '', active: true, sort_order: 0 };

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
}

export function BadgesSection() {
  const { push } = useToast();
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminBadges>> | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awardBusy, setAwardBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<BadgeAwardRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try { setData(await getAdminBadges()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load badge data.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const query = studentQuery.trim();
    if (query.length < 2) { setStudents([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchAdminStudents({ query, page: 1, pageSize: 8 }).then((result) => {
        if (active) setStudents(result.items);
      }).catch(() => { if (active) setStudents([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [studentQuery]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (draft.title.trim().length < 2) return;
    setSaving(true);
    try {
      await saveAdminBadge({
        id: draft.id, title: draft.title.trim(), description: draft.description.trim(), criteria: draft.criteria.trim(),
        category: draft.category, rarity: draft.rarity, imageUrl: draft.image_url.trim(), active: draft.active,
        sortOrder: Number(draft.sort_order) || 0,
      });
      setDraft(EMPTY);
      await refresh();
      push('Badge saved.', 'success');
    } catch (err) { push(err instanceof Error ? err.message : 'Badge could not be saved.', 'error'); }
    finally { setSaving(false); }
  }

  async function award(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUid || !selectedBadge) return;
    setAwardBusy(true);
    try {
      const result = await awardAdminBadge(selectedBadge, selectedUid, awardReason.trim());
      push(result.alreadyAwarded ? 'This student already has this badge.' : 'Badge awarded successfully.', result.alreadyAwarded ? 'info' : 'success');
      setSelectedUid(''); setStudentQuery(''); setStudents([]); setAwardReason('');
      await refresh();
    } catch (err) { push(err instanceof Error ? err.message : 'Award could not be completed.', 'error'); }
    finally { setAwardBusy(false); }
  }

  async function revoke(event: React.FormEvent) {
    event.preventDefault();
    if (!revokeTarget || revokeReason.trim().length < 3) return;
    setRevokeBusy(true);
    try {
      await revokeAdminBadge(revokeTarget.id, revokeReason.trim());
      push('Badge revoked; the history has been retained.', 'success');
      setRevokeTarget(null); setRevokeReason(''); await refresh();
    } catch (err) { push(err instanceof Error ? err.message : 'Revocation failed.', 'error'); }
    finally { setRevokeBusy(false); }
  }

  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Students & community" title="Badges & achievements"
      description="Create achievement definitions, award them to verified student records, and preserve a reasoned history for every grant or revocation."
      actions={<Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw size={14} className="mr-2" />Refresh</Button>} />
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button className="ml-2 underline" onClick={() => { setLoading(true); void refresh(); }}>Retry</button></div>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ['Definitions', data?.counts.definitions ?? '—'], ['Active awards', data?.counts.activeAwards ?? '—'], ['Verified profiles', data?.counts.verifiedStudents ?? '—'],
      ].map(([label, value]) => <Card key={label} className="p-4"><p className="text-xs font-semibold text-ink-500">{label}</p><p className="mt-1 text-2xl font-extrabold tabular-nums">{loading ? '…' : value}</p></Card>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] items-start">
      <Panel title={draft.id ? 'Edit badge' : 'Create badge'} description="Choose a clear title, category and rarity. Student achievement images currently use a secure HTTPS image reference; binary upload is not enabled for public badge assets.">
        <form className="space-y-3" onSubmit={(event) => void save(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Badge title" required><input className="ec-field" required minLength={2} maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Physics Master" /></Field>
            <Field label="Category"><select className="ec-field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as BadgeCategory })}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          </div>
          <Field label="Short description"><textarea className="ec-field min-h-20" maxLength={280} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this achievement recognises" /></Field>
          <Field label="Criteria or details"><textarea className="ec-field min-h-20" maxLength={1000} value={draft.criteria} onChange={(e) => setDraft({ ...draft, criteria: e.target.value })} placeholder="Describe how the achievement is understood" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rarity"><select className="ec-field" value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: e.target.value as BadgeRarity })}>{RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity[0].toUpperCase() + rarity.slice(1)}</option>)}</select></Field>
            <Field label="Display order"><input type="number" min={0} max={10000} className="ec-field" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Image URL (optional)" help="HTTPS only. Do not use private student-file links; this URL is shown on student profiles."><input type="url" className="ec-field" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…" /></Field>
          {draft.title && <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/70 p-3" aria-label="Badge preview">
            <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border ${draft.rarity === 'legendary' ? 'border-amber-300 bg-amber-50 text-amber-700' : draft.rarity === 'epic' ? 'border-violet-200 bg-violet-50 text-violet-700' : draft.rarity === 'rare' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-ink-200 bg-white text-brand-700'}`}>
              {draft.image_url ? <img src={draft.image_url} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : draft.category === 'verified' ? <BadgeCheck size={28} aria-hidden /> : <Award size={28} aria-hidden />}
            </div><div className="min-w-0"><p className="font-bold text-ink-900">{draft.title}</p><p className="text-xs text-ink-500">{draft.description || 'Badge description preview'} · {draft.rarity}</p>{draft.category === 'verified' && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ShieldCheck size={13} /> Verified status mark</p>}</div>
          </div>}
          <div className="flex flex-wrap gap-2"><Button type="submit" loading={saving}><Award size={15} className="mr-2" />{draft.id ? 'Save changes' : 'Create badge'}</Button>{draft.id && <Button type="button" variant="outline" onClick={() => setDraft(EMPTY)}>Cancel edit</Button>}</div>
        </form>
      </Panel>

      <Panel title="Manual award" description="Search the student directory, choose a badge and enter an optional context. Server-side checks prevent duplicate active awards.">
        <form className="space-y-3" onSubmit={(event) => void award(event)}>
          <Field label="Student search" required><div className="relative"><Search size={15} className="absolute left-3 top-3 text-ink-400" /><input className="ec-field pl-9" value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setSelectedUid(''); }} placeholder="Name or email (2+ characters)" autoComplete="off" /></div></Field>
          {students.length > 0 && <div className="max-h-44 overflow-auto rounded-xl border border-ink-200" role="listbox" aria-label="Student search results">{students.map((student) => <button type="button" key={student.firebase_uid} role="option" aria-selected={selectedUid === student.firebase_uid} className="block w-full border-b border-ink-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-brand-50" onClick={() => { setSelectedUid(student.firebase_uid); setStudentQuery(`${student.display_name} · ${student.email || student.firebase_uid}`); setStudents([]); }}><span className="block font-semibold">{student.display_name}</span><span className="text-xs text-ink-500">{student.email || student.firebase_uid} · {student.exam} · Class {student.class_level}</span></button>)}</div>}
          {selectedUid && <StatusPill tone="success">Student selected</StatusPill>}
          <Field label="Badge" required><select className="ec-field" required value={selectedBadge} onChange={(e) => setSelectedBadge(e.target.value)}><option value="">Choose a badge</option>{(data?.items || []).filter((item) => Boolean(item.active)).map((badge) => <option key={badge.id} value={badge.id}>{badge.title}{badge.category === 'verified' ? ' · verified' : ''}</option>)}</select></Field>
          <Field label="Reason / context"><textarea className="ec-field min-h-20" maxLength={500} value={awardReason} onChange={(e) => setAwardReason(e.target.value)} placeholder="Optional; recorded in the award history" /></Field>
          <Button type="submit" loading={awardBusy} disabled={!selectedUid || !selectedBadge}><Plus size={15} className="mr-2" />Confirm award</Button>
        </form>
        {data?.items.some((item) => item.category === 'verified') && <p className="mt-3 text-xs text-ink-500">The blue verification mark is a server-recorded verified-category award. Profile editing cannot grant or alter it.</p>}
      </Panel>
    </div>

    <Panel title="Badge catalogue" description="Definitions and active award totals.">
      {!data?.items.length ? <EmptyState title="No badges created yet" description="Create the first badge using the form above." icon={<Award size={20} />} /> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((badge) => <div key={badge.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-100 p-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-700">{badge.image_url ? <img src={badge.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : badge.category === 'verified' ? <BadgeCheck size={22} /> : <Award size={22} />}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{badge.title}</p><p className="text-xs text-ink-500">{badge.active_awards || 0} awards · {badge.rarity} · {badge.active ? 'Active' : 'Inactive'}</p></div>
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...badge, active: Boolean(badge.active), sort_order: badge.sort_order || 0 })}>Edit</Button>
      </div>)}</div>}
    </Panel>

    <Panel title="Active awards" description="Recent student awards. Revocations require a reason and remain visible in history.">
      {!data?.activeAwards.length ? <EmptyState title="No active awards" description="Confirmed awards appear here." icon={<Award size={20} />} /> : <div className="space-y-2">{data.activeAwards.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
        <div className="min-w-0"><p className="text-sm font-semibold">{record.badge_title} <span className="font-normal text-ink-500">→ {record.display_name || record.email || record.firebase_uid}</span></p><p className="text-xs text-ink-500">{record.email || record.firebase_uid} · {timeLabel(record.awarded_at)}{record.reason ? ` · ${record.reason}` : ''}</p></div>
        <Button size="sm" variant="outline" onClick={() => setRevokeTarget(record)}>Revoke</Button>
      </div>)}</div>}
    </Panel>

    <Panel title="Recent award history" description="Server-written grant and revocation events.">
      {!data?.history.length ? <p className="text-sm text-ink-500">No history yet.</p> : <div className="divide-y divide-ink-100">{data.history.slice(0, 30).map((entry, index) => <div key={`${String(entry.id)}-${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span><strong>{String(entry.action)}</strong> · {String(entry.badge_title)} · {String(entry.display_name || entry.email || entry.firebase_uid)}</span><span className="text-ink-500">{timeLabel(String(entry.created_at))}{entry.reason ? ` · ${String(entry.reason)}` : ''}</span></div>)}</div>}
    </Panel>

    {revokeTarget && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRevokeTarget(null); }}><section role="dialog" aria-modal="true" aria-labelledby="revoke-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h2 id="revoke-title" className="text-lg font-bold">Revoke {revokeTarget.badge_title}?</h2><p className="mt-1 text-sm text-ink-500">The student loses the active mark; the award record is preserved.</p><form className="mt-4 space-y-3" onSubmit={(event) => void revoke(event)}><Field label="Reason (required)" required><textarea autoFocus minLength={3} maxLength={500} required className="ec-field min-h-24" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Why is this award being revoked?" /></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button><Button type="submit" variant="danger" loading={revokeBusy}>Confirm revoke</Button></div></form></section></div>}
  </div>;
}
