'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import {
  getAdminOverview, getAdminContentList, createAdminContent, updateAdminContent, disableAdminContent,
  getAdminAnnouncements, createAdminAnnouncement, updateAdminAnnouncement, getAdminStudents,
  getAdminSubjects, createAdminSubject, setCourseSubjects, uploadAdminPdf, getCourseFiles, invalidateAuthorizedBlobCache,
} from '@/lib/api';
import { fetchVideoMetadata, importFullYoutubePlaylist, extractYoutubeVideoId, extractYoutubePlaylistId, getYoutubeDefaultThumbnail } from '@/lib/mediaProxy';
import { fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import { isSafeHttpUrl, validateQuestionsJson } from '@/lib/validation';
import type { CourseCatalogItem, DriveFileItem, Subject } from '@/types';
import YoutubeThumbnail from '@/components/YoutubeThumbnail';
import { ProfileImage } from '@/components/student/ProfileImage';

export type AdminTab = 'overview'|'goals'|'batches'|'lectures'|'series'|'tests'|'events'|'announcements'|'students'|'feedback';

export default function AdminPage({ embedded = false, initialTab }: { embedded?: boolean; initialTab?: AdminTab } = {}){
  const { user, isAdmin, initializing } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<AdminTab>(initialTab || 'overview');
  const [overview, setOverview] = useState<any>(null);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovError, setOvError] = useState<string|null>(null);

  const loadOverview = useCallback(async()=>{
    setOvLoading(true); setOvError(null);
    try{
      const data = await getAdminOverview();
      setOverview(data);
    }catch(e){ setOvError(e instanceof Error? e.message : 'Failed'); }
    finally{ setOvLoading(false); }
  },[]);

  useEffect(()=>{ if(isAdmin) loadOverview(); },[isAdmin, loadOverview]);

  if(initializing) return <div className="max-w-4xl mx-auto p-6 text-sm text-ink-500">Loading…</div>;
  if(!user) return <Card className="max-w-xl mx-auto p-6 text-center"><p className="font-semibold">Sign in required</p><Link href="/login" className="inline-flex mt-3 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm">Sign in</Link></Card>;
  if(!isAdmin) return <Card className="max-w-xl mx-auto p-8 text-center border-red-200 bg-red-50"><h2 className="font-bold text-red-800">Access denied</h2><p className="text-sm text-red-700 mt-1">You are signed in as {user.email}. Admin access is restricted to arvinddarabishnoi@gmail.com checked server-side via Firebase token. Client check is UX only.</p><Link href="/home" className="inline-flex mt-4 px-4 py-2 bg-white border border-red-200 rounded-xl text-sm">Go home</Link></Card>;

  const tabs: {id:AdminTab; label:string}[] = [
    {id:'overview', label:'Overview'},
    {id:'goals', label:"Goals"},
    {id:'batches', label:'Batches'},
    {id:'lectures', label:'Lectures'},
    {id:'series', label:'Series'},
    {id:'tests', label:'Tests'},
    {id:'events', label:'Events'},
    {id:'announcements', label:'Announcements'},
    {id:'students', label:'Students'},
    {id:'feedback', label:'Feedback'},
  ];

  return (
    <div className={embedded ? '' : 'max-w-6xl mx-auto'}>
      {embedded ? (
        <div className="mb-4 rounded-xl border border-ink-200 bg-ink-50/70 px-4 py-3">
          <p className="text-sm font-semibold">Original content console</p>
          <p className="text-[11px] text-ink-500 mt-0.5">
            These are the original Exam Cracker tools, preserved as-is — including the YouTube playlist importer, which
            has not been modified here and keeps the latest upstream fixes.
          </p>
        </div>
      ) : (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-ink-500">Protected — server verifies Firebase ID token email == arvinddarabishnoi@gmail.com. No public admin registration.</p>
        </div>
        <Badge variant="info">Admin: {user.email}</Badge>
      </div>
      )}

      <div className="flex gap-2 overflow-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=> setTab(t.id)} className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border ${tab===t.id?'bg-ink-900 text-white border-ink-900':'bg-white border-ink-200 text-ink-700'}`}>{t.label}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab==='overview' && <AdminOverviewSection overview={overview} loading={ovLoading} error={ovError} onReload={loadOverview} />}
        {tab==='goals' && <AdminContentTab kind="goal" />}
        {tab==='batches' && <AdminContentTab kind="batch" />}
        {tab==='lectures' && <AdminLecturesTab />}
        {tab==='series' && <AdminContentTab kind="series" />}
        {tab==='tests' && <AdminTestsTab />}
        {tab==='events' && <AdminContentTab kind="event" />}
        {tab==='announcements' && <AdminAnnouncementsTab />}
        {tab==='students' && <AdminStudentsTab />}
        {tab==='feedback' && <AdminFeedbackTab />}
      </div>
    </div>
  );
}

function AdminOverviewSection({ overview, loading, error, onReload }: { overview:any; loading:boolean; error:string|null; onReload:()=>void }){
  if(loading) return <Skeleton className="h-60 w-full" />;
  if(error) return <Card className="p-4 bg-red-50 border-red-200 text-sm text-red-700">{error} <Button size="sm" variant="outline" className="ml-2" onClick={onReload}>Retry</Button></Card>;
  if(!overview) return <Card className="p-6 text-center text-sm text-ink-500">No data. <Button size="sm" onClick={onReload}>Load</Button></Card>;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(overview.counts || {}).map(([k,v])=>(
          <Card key={k} className="p-4 text-center"><p className="text-xl font-bold">{String(v)}</p><p className="text-xs text-ink-500 capitalize">{k.replace('_',' ')}</p></Card>
        ))}
      </div>
      <Card className="p-4">
        <h3 className="font-semibold">Latest content</h3>
        <div className="mt-3 space-y-2">
          {(overview.latestContent||[]).map((c:any)=>(
            <div key={c.id} className="flex items-center justify-between p-2 bg-ink-50 rounded-xl text-sm">
              <span className="font-medium">{c.title} <Badge>{c.kind}</Badge></span>
              <span className="text-xs text-ink-500">{c.exam} • {c.classes.join('/')}</span>
            </div>
          ))}
          {(!overview.latestContent || overview.latestContent.length===0) && <p className="text-sm text-ink-500">No content yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function AdminContentTab({ kind }: { kind: 'goal'|'batch'|'series'|'event' }){
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseCatalogItem|null>(null);
  const [form, setForm] = useState<any>({
    title:'', description:'', exam:'JEE', classes:['11'], active:true, accessCode:'',
    // goal-specific
    startsAt:'', endsAt:'', deepLink:'', ctaLabel:'', priority:'',
    // batch/series
    thumbnailUrl:'', codeDisplay:'', instructor:'', features:'',
    // event
    images:'', subtitle:'',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceSubjectIds, setWorkspaceSubjectIds] = useState<string[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [savingSubjects, setSavingSubjects] = useState(false);

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const [data, subjectRows] = await Promise.all([
        getAdminContentList({ kind }),
        (kind === 'batch' || kind === 'series') ? getAdminSubjects({ includeArchived: false }) : Promise.resolve([] as Subject[]),
      ]);
      setItems(data);
      setSubjects(subjectRows);
    }catch(e){ setError(e instanceof Error? e.message:'Failed'); }
    finally{ setLoading(false); }
  },[kind]);
  useEffect(()=>{ load(); },[load]);

  useEffect(() => {
    if (!workspaceId) return;
    setWorkspaceSubjectIds(subjects
      .filter((subject) => subject.assignments?.some((assignment) => assignment.courseId === workspaceId))
      .map((subject) => subject.id));
  }, [workspaceId, subjects]);

  async function saveWorkspaceSubjects(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId) return;
    setSavingSubjects(true);
    try {
      await setCourseSubjects(workspaceId, workspaceSubjectIds);
      push('Subject assignments saved to D1.','success');
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not save subject assignments.','error');
    } finally {
      setSavingSubjects(false);
    }
  }

  async function createAndAssignSubject(event: React.FormEvent) {
    event.preventDefault();
    const course = items.find((item) => item.id === workspaceId);
    const name = newSubjectName.trim();
    if (!course || !name) return;
    setSavingSubjects(true);
    try {
      const created = await createAdminSubject({
        name,
        description: '',
        exam: course.exam,
        classes: course.classes,
        active: true,
        sortOrder: subjects.length + 1,
      });
      await setCourseSubjects(workspaceId, [...workspaceSubjectIds, created.id]);
      setNewSubjectName('');
      push(`${created.name} created and assigned to ${course.title}.`,'success');
      await load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not create and assign this subject.','error');
    } finally {
      setSavingSubjects(false);
    }
  }

  const visibleItems = items.filter((item) => {
    const query = search.trim().toLowerCase();
    if (query && !`${item.title} ${item.description}`.toLowerCase().includes(query)) return false;
    if (examFilter !== 'all' && item.exam !== examFilter && item.exam !== 'Both') return false;
    if (classFilter !== 'all' && !item.classes.includes(classFilter as '11' | '12')) return false;
    if (stateFilter === 'active' && !item.active) return false;
    if (stateFilter === 'disabled' && item.active) return false;
    return true;
  });

  function openCreate(){
    setEditing(null);
    setForm({ title:'', description:'', exam:'JEE', classes:['11'], active:true, accessCode:'', startsAt:'', endsAt:'', deepLink:'', ctaLabel:'', priority:'', thumbnailUrl:'', codeDisplay:'', instructor:'', features:'', images:'', subtitle:'' });
    setShowForm(true);
  }
  function openEdit(item: CourseCatalogItem){
    setEditing(item);
    const meta = item.metadata as Record<string,any>;
    setForm({
      title: item.title, description: item.description, exam: item.exam, classes: item.classes, active: item.active, accessCode: (item as any).access_code || '',
      startsAt: meta.startsAt ? toISTDateTimeLocalInput(meta.startsAt) : meta.starts_at ? toISTDateTimeLocalInput(meta.starts_at) : '',
      endsAt: meta.endsAt ? toISTDateTimeLocalInput(meta.endsAt) : meta.ends_at ? toISTDateTimeLocalInput(meta.ends_at) : '',
      deepLink: meta.deepLink || meta.deep_link || '', ctaLabel: meta.ctaLabel || '', priority: meta.priority || '',
      thumbnailUrl: meta.thumbnailUrl || '', codeDisplay: meta.codeDisplay || '', instructor: meta.instructor || '', features: Array.isArray(meta.features)? meta.features.join(', '): (meta.features||''), images: Array.isArray(meta.images)? meta.images.map((i:any)=> i.url).join(', '): (meta.images||''), subtitle: meta.subtitle || '',
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent){
    e.preventDefault();
    if(!form.title.trim() || form.title.trim().length>180){ push('Title required under 180 chars','error'); return; }
    if(!['JEE','NEET','Both'].includes(form.exam)){ push('Exam must be JEE/NEET/Both','error'); return; }
    if(!form.classes.length){ push('Select at least one class','error'); return; }
    if(form.thumbnailUrl && !isSafeHttpUrl(form.thumbnailUrl)){ push('Thumbnail must be http(s) URL','error'); return; }
    setSaving(true);
    try{
      const metadata: Record<string, unknown> = {};
      if(kind==='goal'){
        if(form.startsAt) { const iso = fromISTDateTimeLocalInput(form.startsAt); if(iso) metadata.startsAt = iso; }
        if(form.endsAt) { const iso = fromISTDateTimeLocalInput(form.endsAt); if(iso) metadata.endsAt = iso; }
        if(form.deepLink) metadata.deepLink = form.deepLink;
        if(form.ctaLabel) metadata.ctaLabel = form.ctaLabel;
        if(form.priority) metadata.priority = Number(form.priority);
        metadata.displayText = form.description;
      } else if(kind==='batch' || kind==='series'){
        if(form.thumbnailUrl) metadata.thumbnailUrl = form.thumbnailUrl;
        if(form.codeDisplay) metadata.codeDisplay = form.codeDisplay;
        if(form.instructor) metadata.instructor = form.instructor;
        if(form.features) metadata.features = form.features.split(',').map((s:string)=> s.trim()).filter(Boolean);
      } else if(kind==='event'){
        if(form.thumbnailUrl) metadata.thumbnailUrl = form.thumbnailUrl;
        if(form.subtitle) metadata.subtitle = form.subtitle;
        if(form.startsAt) { const iso = fromISTDateTimeLocalInput(form.startsAt); if(iso) metadata.startsAt = iso; }
        if(form.endsAt) { const iso = fromISTDateTimeLocalInput(form.endsAt); if(iso) metadata.endsAt = iso; }
        if(form.deepLink) metadata.deepLink = form.deepLink;
        if(form.ctaLabel) metadata.ctaLabel = form.ctaLabel;
        if(form.images) {
          const urls = form.images.split(',').map((s:string)=> s.trim()).filter(Boolean);
          metadata.images = urls.map((u:string)=> ({ url: u }));
        }
      }
      const payload = {
        kind, title: form.title.trim(), description: form.description.slice(0,10000),
        exam: form.exam, classes: form.classes, active: !!form.active, accessCode: form.accessCode || null, metadata
      };
      if(editing){
        await updateAdminContent(editing.id, payload);
        push('Updated','success');
      } else {
        await createAdminContent(payload);
        push('Created','success');
      }
      setShowForm(false);
      await load();
    }catch(err){ push(err instanceof Error? err.message:'Save failed','error'); }
    finally{ setSaving(false); }
  }

  async function handleToggleActive(item: CourseCatalogItem){
    if(item.active && !confirm(`Disable “${item.title}”? Its data and relationships will be preserved.`)) return;
    try{
      if(item.active){
        await disableAdminContent(item.id);
        push('Disabled. You can restore it from this list.','success');
      } else {
        await updateAdminContent(item.id, {
          kind: item.kind as any,
          title: item.title,
          description: item.description,
          exam: item.exam,
          classes: item.classes,
          active: true,
          accessCode: (item as any).access_code ?? null,
          metadata: item.metadata as Record<string, unknown>,
          parentId: item.parentId,
          subjectId: item.subjectId,
          sortOrder: item.sortOrder,
        });
        push('Restored and published.','success');
      }
      await load();
    }catch(err){ push(err instanceof Error? err.message:'Could not update content state.','error'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold capitalize">{kind}s • Admin</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>Refresh</Button>
          <Button onClick={openCreate}>+ Create {kind}</Button>
        </div>
      </div>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error} <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Retry</Button></div>}
      {!loading && !error && items.length===0 && <EmptyState title={`No ${kind}s yet`} description={`Create your first ${kind} — exam, class, title, description, active flag and metadata fields.`} />}
      {items.length > 0 && (
        <div className="grid gap-2 rounded-2xl border border-ink-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind}s`} />
          <Select label="Exam" value={examFilter} onChange={(event) => setExamFilter(event.target.value)}><option value="all">All exams</option><option value="JEE">JEE</option><option value="NEET">NEET</option></Select>
          <Select label="Class" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">All classes</option><option value="11">Class 11</option><option value="12">Class 12</option></Select>
          <Select label="State" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="all">Active and disabled</option><option value="active">Active</option><option value="disabled">Disabled</option></Select>
          <p className="text-xs text-ink-500 sm:col-span-2 lg:col-span-4" aria-live="polite">Showing {visibleItems.length} of {items.length} {kind}s · disabled content remains available here to restore.</p>
        </div>
      )}
      {!loading && !error && items.length > 0 && visibleItems.length === 0 && <EmptyState title="No content matches these filters" description="Try a different search, exam, class or state." />}

      <div className="grid gap-3">
        {visibleItems.map(it=>{
          const meta = it.metadata as Record<string,any>;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{it.title} <Badge variant={it.active?'success':'danger'}>{it.active?'Active':'Disabled'}</Badge> <Badge>{it.exam}</Badge> <Badge>{it.classes.join('/')}</Badge></p>
                  <p className="text-sm text-ink-600 mt-1 line-clamp-2">{it.description}</p>
                  <p className="text-xs text-ink-400 mt-1">ID {it.id.slice(0,8)} • {new Date(it.updated_at).toLocaleString('en-IN')} • {meta.startsAt? `Start ${meta.startsAt}`:''} {meta.thumbnailUrl? `Thumb: ${String(meta.thumbnailUrl).slice(0,40)}`:''}</p>
                  {kind==='goal' && <p className="text-xs mt-1">CTA {meta.ctaLabel} • Link {meta.deepLink} • Priority {meta.priority}</p>}
                  {kind==='event' && meta.images && <p className="text-xs">Images: {JSON.stringify(meta.images).slice(0,120)}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {(kind === 'batch' || kind === 'series') && <Button size="sm" onClick={() => setWorkspaceId(it.id)} aria-expanded={workspaceId === it.id}>Manage</Button>}
                  <Button size="sm" variant="outline" onClick={()=> openEdit(it)}>Edit</Button>
                  <Button size="sm" variant={it.active ? 'danger' : 'outline'} onClick={()=> handleToggleActive(it)}>{it.active ? 'Disable' : 'Restore'}</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {(kind === 'batch' || kind === 'series') && items.some((item) => item.id === workspaceId) && (() => {
        const course = items.find((item) => item.id === workspaceId)!;
        const assignedCount = workspaceSubjectIds.length;
        return (
          <Card className="space-y-4 border-brand-200 p-5" aria-label={`${course.title} management workspace`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">{course.kind} workspace</p>
                <h3 className="text-lg font-extrabold">{course.title}</h3>
                <p className="text-xs text-ink-500">{assignedCount} subject{assignedCount === 1 ? '' : 's'} assigned · lectures and resources are grouped by subject.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/lectures/${encodeURIComponent(course.id)}`} className="ec-btn border border-ink-200 px-3 py-2 text-xs font-bold">Preview learning tree</Link>
                <button type="button" className="ec-btn px-3 py-2 text-xs font-bold text-ink-500 hover:bg-ink-100" onClick={() => setWorkspaceId('')}>Close</button>
              </div>
            </div>
            <form onSubmit={saveWorkspaceSubjects} className="space-y-3">
              <fieldset>
                <legend className="mb-2 text-sm font-bold">Assigned subjects</legend>
                {subjects.filter((subject) => subject.active && !subject.archived).length ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {subjects.filter((subject) => subject.active && !subject.archived).map((subject) => {
                      const checked = workspaceSubjectIds.includes(subject.id);
                      const examOkay = subject.exam === 'Both' || course.exam === 'Both' || subject.exam === course.exam;
                      const classOkay = subject.classes.some((level) => course.classes.includes(level));
                      return (
                        <label key={subject.id} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${checked ? 'border-brand-300 bg-brand-50/70' : 'border-ink-200'}`}>
                          <input type="checkbox" checked={checked} disabled={!examOkay || !classOkay} onChange={(event) => setWorkspaceSubjectIds((previous) => event.target.checked ? [...new Set([...previous, subject.id])] : previous.filter((id) => id !== subject.id))} />
                          <span className="min-w-0"><span className="block font-semibold">{subject.name}</span><span className="text-[10px] text-ink-500">{subject.exam} · Class {subject.classes.join('/')}{!examOkay || !classOkay ? ' · not applicable' : ''}</span></span>
                        </label>
                      );
                    })}
                  </div>
                ) : <p className="rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-500">No subjects yet. Create one here and it will be linked to this {course.kind}.</p>}
              </fieldset>
              <div className="flex flex-wrap items-end gap-2">
                <Button type="submit" loading={savingSubjects}>Save subject assignments</Button>
                <Link href={`/admin/lectures?parentId=${encodeURIComponent(course.id)}`} className="ec-btn border border-ink-200 px-3 py-2 text-xs font-bold">Manage lectures &amp; resources</Link>
              </div>
            </form>
            <form onSubmit={createAndAssignSubject} className="grid gap-2 rounded-xl border border-ink-200 bg-ink-50/50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input label="Create and assign a subject" value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="e.g. Physics" maxLength={100} required />
              <Button type="submit" variant="outline" loading={savingSubjects} disabled={!newSubjectName.trim()}>Create &amp; assign</Button>
              <p className="text-[11px] text-ink-500 sm:col-span-2">Uses this {course.exam} · Class {course.classes.join('/')} scope. The subject and course link are saved to D1 together through authenticated API calls.</p>
            </form>
            {workspaceSubjectIds.map((subjectId) => {
              const subject = subjects.find((row) => row.id === subjectId);
              if (!subject) return null;
              return <div key={subjectId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm"><span className="font-semibold">{subject.name}</span><Link href={`/admin/lectures?parentId=${encodeURIComponent(course.id)}&subjectId=${encodeURIComponent(subject.id)}`} className="text-xs font-bold text-brand-700 hover:underline">Open subject · Add lecture →</Link></div>;
            })}
          </Card>
        );
      })()}

      {showForm && (
        <Card className="p-6 border-brand-200">
          <h3 className="font-bold mb-3">{editing? 'Edit':'Create'} {kind}</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <Input label="Title*" value={form.title} onChange={e=> setForm((s:any)=> ({...s, title:e.target.value}))} required />
            <Textarea label="Description" value={form.description} onChange={e=> setForm((s:any)=> ({...s, description:e.target.value}))} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Exam*" value={form.exam} onChange={e=> setForm((s:any)=>({...s, exam:e.target.value}))}><option>JEE</option><option>NEET</option><option>Both</option></Select>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Classes*</label>
                <div className="flex gap-2">
                  {['11','12'].map(c=>(
                    <label key={c} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.classes.includes(c)} onChange={e=> setForm((s:any)=> ({...s, classes: e.target.checked? [...s.classes,c]: s.classes.filter((x:string)=>x!==c)}))} /> {c}</label>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={e=> setForm((s:any)=>({...s, active:e.target.checked}))} /> Active</label>
            <Input label="Access code (optional, server-enforced)" placeholder="Leave blank for open enrolment" value={form.accessCode} onChange={e=> setForm((s:any)=>({...s, accessCode:e.target.value}))} />

            {(kind==='batch' || kind==='series' || kind==='event') && (
              <>
                <Input label="Thumbnail URL" placeholder="https://..." value={form.thumbnailUrl} onChange={e=> setForm((s:any)=>({...s, thumbnailUrl:e.target.value}))} />
                <Input label={kind==='event' ? 'Subtitle' : 'Instructor'} value={kind==='event'? form.subtitle: form.instructor} onChange={e=> setForm((s:any)=>({...s, [kind==='event'?'subtitle':'instructor']: e.target.value}))} />
                {kind!=='event' && <Input label="Code display (informational)" value={form.codeDisplay} onChange={e=> setForm((s:any)=>({...s, codeDisplay:e.target.value}))} />}
                {kind!=='event' && <Input label="Features (comma-separated)" value={form.features} onChange={e=> setForm((s:any)=>({...s, features:e.target.value}))} />}
              </>
            )}

            {(kind==='goal' || kind==='event') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Starts At (IST)" type="datetime-local" value={form.startsAt} onChange={e=> setForm((s:any)=>({...s, startsAt:e.target.value}))} />
                  <Input label="Ends At (IST)" type="datetime-local" value={form.endsAt} onChange={e=> setForm((s:any)=>({...s, endsAt:e.target.value}))} />
                </div>
                <Input label="Deep link (internal)" placeholder="/lectures or /tests/uuid" value={form.deepLink} onChange={e=> setForm((s:any)=>({...s, deepLink:e.target.value}))} />
                <Input label="CTA label" value={form.ctaLabel} onChange={e=> setForm((s:any)=>({...s, ctaLabel:e.target.value}))} />
                {kind==='goal' && <Input label="Priority (number)" type="number" value={form.priority} onChange={e=> setForm((s:any)=>({...s, priority:e.target.value}))} />}
                {kind==='event' && <Input label="Images (comma-separated http URLs)" value={form.images} onChange={e=> setForm((s:any)=>({...s, images:e.target.value}))} />}
              </>
            )}

            <div className="flex gap-2">
              <Button type="submit" loading={saving}>{editing? 'Update':'Create'}</Button>
              <Button type="button" variant="outline" onClick={()=> setShowForm(false)}>Cancel</Button>
            </div>
            <p className="text-xs text-ink-400">Create: POST /admin/content • Update: PATCH /admin/content/:uuid (full form state) • Disable: DELETE (soft-disable). API verifies Firebase token admin.</p>
          </form>
        </Card>
      )}
    </div>
  );
}

const EMPTY_LECTURE_FORM = {
  title:'', description:'', exam:'JEE', classes:['11'], active:true, accessCode:'',
  youtubeUrl:'', videoId:'', thumbnailUrl:'', lesson:'', topic:'', notesPdfUrl:'', isPreview:false,
  parentId:'', subjectId:'', position:'', duration:'', notesFileId:'', notesFileName:''
};

function AdminLecturesTab(){
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [batches, setBatches] = useState<CourseCatalogItem[]>([]);
  const [series, setSeries] = useState<CourseCatalogItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courseFiles, setCourseFiles] = useState<DriveFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [parentFilter, setParentFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [lectureSearch, setLectureSearch] = useState('');
  const [lectureStateFilter, setLectureStateFilter] = useState('all');
  const [lectureExamFilter, setLectureExamFilter] = useState('all');
  const [lectureClassFilter, setLectureClassFilter] = useState('all');
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string|null>(null);
  const pdfInputRef = useRef<HTMLInputElement|null>(null);
  const pdfAbortRef = useRef<AbortController|null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_LECTURE_FORM });
  const [editing, setEditing] = useState<CourseCatalogItem|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistProgress, setPlaylistProgress] = useState('');
  const [playlistError, setPlaylistError] = useState<string|null>(null);
  const [playlistIncomplete, setPlaylistIncomplete] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState('');
  const [playlistExam, setPlaylistExam] = useState('JEE');
  const [playlistClasses, setPlaylistClasses] = useState<string[]>(['11']);
  const [playlistTopic, setPlaylistTopic] = useState('');
  const [playlistSubject, setPlaylistSubject] = useState('');
  const initializedWorkspaceLink = useRef(false);

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const [lectures, b, s, subj] = await Promise.all([
        getAdminContentList({ kind:'lecture' }),
        getAdminContentList({ kind:'batch' }),
        getAdminContentList({ kind:'series' }),
        getAdminSubjects({ includeArchived: false }).catch(() => [] as Subject[]),
      ]);
      setItems(lectures); setBatches(b); setSeries(s); setSubjects(subj);
    }catch(e){ setError(e instanceof Error ? e.message:'Failed'); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  useEffect(() => {
    if (initializedWorkspaceLink.current) return;
    const params = new URLSearchParams(window.location.search);
    const parentId = params.get('parentId') || '';
    if (!parentId || ![...batches, ...series].some((course) => course.id === parentId)) return;
    const subjectId = params.get('subjectId') || '';
    const subjectIsAssigned = subjects.some((subject) => subject.id === subjectId && subject.assignments?.some((assignment) => assignment.courseId === parentId));
    initializedWorkspaceLink.current = true;
    setForm({ ...EMPTY_LECTURE_FORM, parentId, subjectId: subjectIsAssigned ? subjectId : '' });
    setShowForm(true);
  }, [batches, series, subjects]);

  // Subject options come from the parent course's assignment list, so the admin
  // cannot pick a pair the API would reject.
  const subjectsForParent = useCallback((parentId: string) => {
    if (!parentId) return [] as Subject[];
    return subjects.filter((subject) => subject.assignments?.some((a)=> a.courseId===parentId));
  },[subjects]);

  const parentTitle = useCallback((id: string) => {
    const found = [...batches, ...series].find((row)=> row.id===id);
    return found ? `${found.kind==='batch'?'Batch':'Series'}: ${found.title}` : '';
  },[batches, series]);

  const filteredItems = items.filter((item)=>{
    const m = (item.metadata||{}) as Record<string,any>;
    const itemParent = item.parentId || m.parentId || '';
    const itemSubject = item.subjectId || m.subjectId || '';
    if (parentFilter && itemParent !== parentFilter) return false;
    if (subjectFilter && itemSubject !== subjectFilter) return false;
    if (lectureSearch.trim() && !`${item.title} ${item.description} ${m.lesson || ''} ${m.topic || ''}`.toLowerCase().includes(lectureSearch.trim().toLowerCase())) return false;
    if (lectureStateFilter === 'active' && !item.active) return false;
    if (lectureStateFilter === 'disabled' && item.active) return false;
    if (lectureExamFilter !== 'all' && item.exam !== lectureExamFilter && item.exam !== 'Both') return false;
    if (lectureClassFilter !== 'all' && !item.classes.includes(lectureClassFilter as '11' | '12')) return false;
    return true;
  });

  useEffect(()=>{
    let cancelled = false;
    if(!form.parentId){ setCourseFiles([]); return ()=>{ cancelled = true; }; }
    getCourseFiles(form.parentId)
      .then((rows)=>{ if(!cancelled) setCourseFiles(rows); })
      .catch(()=>{ if(!cancelled) setCourseFiles([]); });
    return ()=>{ cancelled = true; };
  },[form.parentId]);

  function openCreate(){
    setEditing(null);
    setPdfError(null);
    setForm({ ...EMPTY_LECTURE_FORM });
    setShowForm(true);
  }
  function openEdit(item: CourseCatalogItem){
    setEditing(item);
    const m = item.metadata as Record<string,any>;
    setPdfError(null);
    setForm({
      title:item.title, description:item.description, exam:item.exam, classes:item.classes, active:item.active, accessCode:(item as any).access_code||'',
      youtubeUrl: m.youtubeUrl||'', videoId: m.videoId||'', thumbnailUrl: m.thumbnailUrl||'', lesson: m.lesson||'', topic: m.topic||'', notesPdfUrl: m.notesPdfUrl||'', isPreview: !!m.isPreview,
      parentId: item.parentId || m.parentId || '', subjectId: item.subjectId || m.subjectId || '', position: item.sortOrder ? String(item.sortOrder) : (m.position||''), duration: m.duration||'',
      notesFileId: m.notesFileId || '', notesFileName: m.notesFileName || '',
    });
    setShowForm(true);
  }

  function handleParentChange(nextParent: string){
    setForm((s:any)=>{
      const stillValid = s.subjectId && subjects.some((subject)=> subject.id===s.subjectId && subject.assignments?.some((a)=> a.courseId===nextParent));
      return { ...s, parentId: nextParent, subjectId: stillValid ? s.subjectId : '' };
    });
  }

  async function handlePdfUpload(file: File | null | undefined){
    if(!file) return;
    if(!form.parentId){ setPdfError('Choose the parent batch or series before uploading a PDF — Drive files are scoped to a course.'); return; }
    const controller = new AbortController();
    pdfAbortRef.current = controller;
    setPdfUploading(true); setPdfProgress(0); setPdfError(null);
    try{
      const record = await uploadAdminPdf({
        courseId: form.parentId,
        file,
        signal: controller.signal,
        onProgress: (percent)=> setPdfProgress(percent),
      });
      setForm((s:any)=> ({ ...s, notesFileId: record.id, notesFileName: record.displayName, notesPdfUrl: '' }));
      push('PDF uploaded to Google Drive. Save the lecture to attach it.', 'success');
    }catch(e){
      setPdfError(e instanceof Error ? e.message : 'The PDF upload failed.');
    }finally{
      setPdfUploading(false);
      pdfAbortRef.current = null;
      if(pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  async function handleFetchMeta(){
    if(!form.youtubeUrl.trim()){ push('Enter YouTube URL first','error'); return; }
    const vid = extractYoutubeVideoId(form.youtubeUrl);
    if(!vid){ push('Invalid YouTube URL','error'); return; }
    setFetchingMeta(true);
    try{
      const meta = await fetchVideoMetadata(form.youtubeUrl);
      setForm((s:any)=> ({...s, title: s.title || meta.title, thumbnailUrl: s.thumbnailUrl || meta.thumbnail, videoId: meta.videoId, description: s.description || `Author: ${meta.author}` }));
      push('Metadata loaded','success');
    }catch(e){ push(e instanceof Error? e.message:'Fetch failed. You can still enter manually.','error'); }
    finally{ setFetchingMeta(false); }
  }

  async function handleSave(e: React.FormEvent){
    e.preventDefault();
    if(!form.title.trim()){ push('Title required','error'); return; }
    if(form.thumbnailUrl && !isSafeHttpUrl(form.thumbnailUrl)){ push('Thumbnail must be http(s)','error'); return; }
    if(form.notesPdfUrl && !isSafeHttpUrl(form.notesPdfUrl)){ push('PDF URL must be http(s)','error'); return; }
    if(form.youtubeUrl && !extractYoutubeVideoId(form.youtubeUrl)){ push('Invalid YouTube URL','error'); return; }
    if(form.subjectId && !form.parentId){ push('Choose a parent batch or series before selecting a subject.','error'); return; }
    if(form.parentId && !form.subjectId){ push('Choose a subject assigned to this batch or series.','error'); return; }
    if(form.notesFileId && !form.parentId){ push('A Drive PDF needs a parent batch or series.','error'); return; }
    setSaving(true);
    try{
      const vid = form.youtubeUrl ? extractYoutubeVideoId(form.youtubeUrl) : (form.videoId || '');
      const metadata: Record<string,unknown> = {
        youtubeUrl: form.youtubeUrl || undefined,
        videoId: vid || undefined,
        thumbnailUrl: form.thumbnailUrl || (vid? getYoutubeDefaultThumbnail(vid): undefined),
        duration: form.duration || undefined,
        position: form.position? Number(form.position): undefined,
        parentId: form.parentId || undefined,
        subjectId: form.subjectId || undefined,
        lesson: form.lesson || undefined,
        topic: form.topic || undefined,
        notesPdfUrl: form.notesFileId ? undefined : (form.notesPdfUrl || undefined),
        notesFileId: form.notesFileId || undefined,
        notesFileName: form.notesFileId ? (form.notesFileName || undefined) : undefined,
        isPreview: !!form.isPreview,
        playlistId: form.playlistId || undefined,
      };
      const payload = {
        kind:'lecture' as const,
        title: form.title.trim(),
        description: form.description.slice(0,10000),
        exam: form.exam,
        classes: form.classes,
        active: !!form.active,
        accessCode: form.accessCode||null,
        metadata,
        parentId: form.parentId || null,
        subjectId: form.subjectId || null,
        sortOrder: form.position ? Number(form.position) : 0,
      };
      if(editing) await updateAdminContent(editing.id, payload);
      else await createAdminContent(payload);
      invalidateAuthorizedBlobCache('/api/ec/files');
      push(editing?'Updated':'Created','success');
      setShowForm(false); await load();
    }catch(err){ push(err instanceof Error? err.message:'Save failed','error'); }
    finally{ setSaving(false); }
  }

  async function handleToggleActive(item: CourseCatalogItem){
    if(item.active && !confirm(`Disable “${item.title}”? Its data and relationships will be preserved.`)) return;
    try{
      if(item.active){
        await disableAdminContent(item.id);
        push('Lecture disabled. You can restore it from this list.','success');
      } else {
        await updateAdminContent(item.id, {
          kind: 'lecture',
          title: item.title,
          description: item.description,
          exam: item.exam,
          classes: item.classes,
          active: true,
          accessCode: (item as any).access_code ?? null,
          metadata: item.metadata as Record<string, unknown>,
          parentId: item.parentId,
          subjectId: item.subjectId,
          sortOrder: item.sortOrder,
        });
        push('Lecture restored and published.','success');
      }
      await load();
    }catch(err){ push(err instanceof Error? err.message:'Could not update lecture state.','error'); }
  }

  async function handlePlaylistImport(){
    if(!playlistUrl.trim()){ push('Paste YouTube playlist URL','error'); return; }
    const pid = extractYoutubePlaylistId(playlistUrl);
    if(!pid){ push('Invalid playlist URL (needs list= param)','error'); return; }
    setPlaylistLoading(true);
    setPlaylistItems([]);
    setPlaylistTitle('');
    setPlaylistError(null);
    setPlaylistProgress('Connecting to the playlist proxy…');
    setPlaylistIncomplete(false);
    try{
      const res = await importFullYoutubePlaylist(playlistUrl, {
        onProgress: (p)=> setPlaylistProgress(`Fetched ${p.pagesFetched} page(s) • ${p.totalItems} unique videos${p.hasMore ? ' • loading more…' : ''}`)
      });
      setPlaylistItems(res.items);
      setPlaylistTitle(res.title);
      const incomplete = Boolean(res.note && (
        res.note.includes('safety limit') ||
        res.note.includes('repeated a pagination cursor') ||
        res.note.includes('did not return a continuation cursor')
      ));
      setPlaylistIncomplete(incomplete);
      const summary = `Imported ${res.items.length} unique videos in ${res.pagesFetched} pages.`;
      if (incomplete) {
        setPlaylistError(`${summary} ${res.note || 'The playlist may be incomplete. Retry before saving.'}`);
        push('Playlist import may be incomplete. Retry before saving.', 'error');
      } else {
        setPlaylistError(null);
        setPlaylistProgress(summary);
        push(summary, 'success');
      }
    }catch(e){
      const message = e instanceof Error ? e.message : 'Playlist import failed. Try manual add.';
      setPlaylistError(message);
      setPlaylistItems([]);
      push(message, 'error');
    }
    finally{ setPlaylistLoading(false); }
  }

  async function handlePlaylistSave(){
    if(!playlistItems.length){ push('No items to save','error'); return; }
    if(!playlistTarget){ push('Select target batch/series','error'); return; }
    if(!playlistSubject){ push('Select a subject assigned to the target batch/series.','error'); return; }
    const selectedItems = playlistItems.filter((i:any)=> i.selected!==false);
    if(!selectedItems.length){ push('Select at least one video','error'); return; }
    const existingVideoIds = new Set(items.map((item:any) => String((item.metadata as Record<string,any>)?.videoId || '')).filter(Boolean));
    const alreadyExists = selectedItems.filter((it:any)=> existingVideoIds.has(String(it.videoId))).length;
    const itemsToSave = selectedItems.filter((it:any)=> !existingVideoIds.has(String(it.videoId)));
    if(!itemsToSave.length){
      push(`All ${alreadyExists} selected videos already exist as lectures. Nothing was duplicated.`,'error');
      return;
    }
    setSaving(true);
    let ok=0, fail=0;
    const failureMessages: string[] = [];
    try {
      for(const it of itemsToSave){
        try{
          const order = playlistItems.findIndex((entry:any)=> entry.videoId === it.videoId) + 1;
          const metadata = {
            youtubeUrl: it.watchUrl, videoId: it.videoId, thumbnailUrl: it.thumbnail, duration: it.duration, position: order, parentId: playlistTarget, lesson: playlistTopic || playlistTitle, topic: playlistTopic || playlistTitle, isPreview:false, playlistId: extractYoutubePlaylistId(playlistUrl)
          };
          await createAdminContent({
            kind:'lecture',
            title: it.title.trim() || `Lecture ${order}`,
            description: it.description || `Imported from playlist ${playlistTitle}`,
            exam: playlistExam as any,
            classes: playlistClasses as any,
            active:true,
            accessCode:null,
            metadata: { ...metadata, subjectId: playlistSubject || undefined },
            parentId: playlistTarget,
            subjectId: playlistSubject || null,
            sortOrder: order,
          });
          ok++;
        }catch(err){
          fail++;
          if(failureMessages.length < 2) {
            failureMessages.push(err instanceof Error ? err.message : 'Unknown save error');
          }
        }
      }
      if(fail === 0) {
        push(`Saved ${ok} lectures${alreadyExists ? `; skipped ${alreadyExists} already-existing videos` : ''}.`, 'success');
      } else if(ok === 0) {
        push(`No new lectures were saved (${fail} failed)${alreadyExists ? `; ${alreadyExists} duplicates skipped` : ''}. ${failureMessages.join(' • ')}`, 'error');
      } else {
        push(`Saved ${ok}; ${fail} failed${alreadyExists ? `; ${alreadyExists} duplicates skipped` : ''}. ${failureMessages.join(' • ')}`, 'error');
      }
    } finally {
      setSaving(false);
      if(ok) await load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Lectures & Playlist Import</h2>
        <div className="flex gap-2"><Button variant="outline" onClick={load}>Refresh</Button><Button onClick={openCreate}>+ Add lecture</Button></div>
      </div>

      {/* Playlist import */}
      <Card className="p-4 border-brand-200">
        <h3 className="font-semibold">Playlist import (no YouTube Data API key)</h3>
        <p className="text-xs text-ink-500 mt-1">Paste public playlist URL → fetch via Cloudflare /playlist → follow nextCursor → deduplicate by videoId → select/reorder/edit → save to batch/series.</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Input placeholder="https://www.youtube.com/playlist?list=..." value={playlistUrl} onChange={e=> setPlaylistUrl(e.target.value)} className="flex-1 min-w-[260px]" />
          <Button loading={playlistLoading} disabled={playlistLoading} onClick={handlePlaylistImport}>Import</Button>
        </div>
        {playlistLoading && <p role="status" aria-live="polite" className="mt-2 text-xs text-brand-700">{playlistProgress}</p>}
        {!playlistLoading && playlistProgress && !playlistError && <p role="status" className="mt-2 text-xs text-ink-500">{playlistProgress}</p>}
        {playlistError && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{playlistError}</div>}
        {playlistItems.length>0 && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <Select label="Target batch/series" value={playlistTarget} onChange={e=> setPlaylistTarget(e.target.value)}>
                <option value="">Select target</option>
                {batches.map(b=> <option key={b.id} value={b.id}>Batch: {b.title}</option>)}
                {series.map(s=> <option key={s.id} value={s.id}>Series: {s.title}</option>)}
              </Select>
              <Select label="Exam" value={playlistExam} onChange={e=> setPlaylistExam(e.target.value)}><option>JEE</option><option>NEET</option><option>Both</option></Select>
              <Select label="Subject*" value={playlistSubject} required onChange={e=> setPlaylistSubject(e.target.value)}>
                <option value="">Choose a subject…</option>
                {playlistTarget
                  ? subjectsForParent(playlistTarget).map(subject=> <option key={subject.id} value={subject.id}>{subject.name}</option>)
                  : subjects.map(subject=> <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Classes</label>
                <div className="flex gap-2 pt-2">
                  {['11','12'].map(c=> <label key={c} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={playlistClasses.includes(c)} onChange={e=> setPlaylistClasses(s=> e.target.checked? [...s,c]: s.filter(x=>x!==c))} />{c}</label>)}
                </div>
              </div>
              <Input label="Lesson/Topic" value={playlistTopic} onChange={e=> setPlaylistTopic(e.target.value)} placeholder={playlistTitle} />
            </div>
            <div className="max-h-96 overflow-auto border border-ink-100 rounded-xl">
              <div className="p-2 bg-ink-50 text-xs font-semibold flex justify-between"><span>{playlistTitle} • {playlistItems.length} items</span><span>{playlistItems.filter((i:any)=> i.selected!==false).length} selected</span></div>
              {playlistItems.map((it:any, idx:number)=>(
                <div key={it.videoId} className="flex gap-3 p-2 border-b border-ink-100">
                  <input type="checkbox" checked={it.selected!==false} onChange={e=> setPlaylistItems(s=> s.map((x:any,i)=> i===idx? {...x, selected:e.target.checked}:x))} />
                  <YoutubeThumbnail src={it.thumbnail} videoId={it.videoId} alt={it.title} className="h-14 w-20 rounded object-cover bg-ink-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <input aria-label={`Lecture ${idx+1} title`} value={it.title} onChange={e=> setPlaylistItems(s=> s.map((x,i)=> i===idx? {...x, title:e.target.value}:x))} className="w-full text-sm font-medium bg-transparent border-b border-transparent focus:border-brand-300 focus:outline-none" />
                    <Textarea value={it.description || ''} onChange={e=> setPlaylistItems(s=> s.map((x,i)=> i===idx? {...x, description:e.target.value}:x))} rows={2} placeholder="Lecture description (optional)" />
                    <p className="text-xs text-ink-500">{it.videoId} • {it.duration}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" disabled={idx===0} onClick={()=> setPlaylistItems(s=> { const next=[...s]; [next[idx-1],next[idx]]=[next[idx],next[idx-1]]; return next; })}>↑</Button>
                    <Button size="sm" variant="outline" disabled={idx===playlistItems.length-1} onClick={()=> setPlaylistItems(s=> { const next=[...s]; [next[idx],next[idx+1]]=[next[idx+1],next[idx]]; return next; })}>↓</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handlePlaylistSave} loading={saving} disabled={saving || playlistLoading || playlistIncomplete}>Save {playlistItems.filter((i:any)=> i.selected!==false).length} lectures to target</Button>
            <p className={`text-xs ${playlistIncomplete ? 'text-red-700 font-semibold' : 'text-ink-400'}`}>{playlistIncomplete ? 'Saving is disabled because pagination was incomplete. Retry the import so videos are not silently missed.' : 'Review the selected videos before saving. Uses public YouTube page metadata; private, removed or region-blocked videos may be unavailable.'}</p>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Search lectures" type="search" value={lectureSearch} onChange={e=> setLectureSearch(e.target.value)} placeholder="Title, topic or description" />
          <Select label="Filter by course" value={parentFilter} onChange={e=> setParentFilter(e.target.value)}>
            <option value="">All batches &amp; series</option>
            {batches.map(b=> <option key={b.id} value={b.id}>Batch: {b.title}</option>)}
            {series.map(s=> <option key={s.id} value={s.id}>Series: {s.title}</option>)}
          </Select>
          <Select label="Filter by subject" value={subjectFilter} onChange={e=> setSubjectFilter(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map(subject=> <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </Select>
          <Select label="Exam" value={lectureExamFilter} onChange={e=> setLectureExamFilter(e.target.value)}><option value="all">All exams</option><option value="JEE">JEE</option><option value="NEET">NEET</option></Select>
          <Select label="Class" value={lectureClassFilter} onChange={e=> setLectureClassFilter(e.target.value)}><option value="all">All classes</option><option value="11">Class 11</option><option value="12">Class 12</option></Select>
          <Select label="State" value={lectureStateFilter} onChange={e=> setLectureStateFilter(e.target.value)}><option value="all">Active and disabled</option><option value="active">Active</option><option value="disabled">Disabled</option></Select>
          <p className="pb-2 text-xs text-ink-500 self-end">
            {filteredItems.length} of {items.length} lecture{items.length===1?'':'s'}
            {subjects.length===0 && <> · no subjects yet — <Link href="/admin/subjects" className="font-semibold text-brand-700 hover:underline">create one</Link></>}
          </p>
        </div>
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length===0 && <EmptyState title="No lectures yet" description="Add lectures manually or via playlist import. Exam/class parentId enrolment respects server gate." />}
      {!loading && items.length>0 && filteredItems.length===0 && (
        <EmptyState title="No lectures match this filter" description="Clear the course or subject filter to see the full lecture list." />
      )}

      <div className="grid gap-3">
        {filteredItems.map(it=>{
          const m = it.metadata as Record<string,any>;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex gap-3">
                <YoutubeThumbnail src={m.thumbnailUrl || (m.videoId? getYoutubeDefaultThumbnail(m.videoId):'')} videoId={String(m.videoId || '')} alt={it.title} className="h-16 w-28 rounded-xl object-cover bg-ink-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{it.title} <Badge variant={it.active?'success':'danger'}>{it.active?'Active':'Disabled'}</Badge> <Badge>{it.exam}</Badge> <Badge>{it.classes.join('/')}</Badge></p>
                  <p className="text-xs text-ink-500 line-clamp-2">{it.description}</p>
                  <p className="text-xs text-ink-400 mt-1">
                    Video {m.videoId || '—'} • Parent {parentTitle(it.parentId || m.parentId) || '—'} •{' '}
                    Subject {subjects.find(subject=> subject.id===(it.subjectId || m.subjectId))?.name || 'Unassigned'} • Lesson {m.lesson||'—'} • {m.isPreview?'Preview':''}
                  </p>
                  {m.notesFileId ? (
                    <span className="text-xs font-semibold text-emerald-700">Drive PDF attached{m.notesFileName? `: ${m.notesFileName}`:''}</span>
                  ) : m.notesPdfUrl ? (
                    <a href={m.notesPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600">PDF →</a>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={()=> openEdit(it)}>Edit</Button>
                  <Button size="sm" variant={it.active ? 'danger' : 'outline'} onClick={()=> handleToggleActive(it)}>{it.active ? 'Disable' : 'Restore'}</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card className="p-6 border-brand-200">
          <h3 className="font-bold mb-3">{editing? 'Edit':'Add'} lecture</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <Input label="YouTube URL*" placeholder="https://www.youtube.com/watch?v=..." value={form.youtubeUrl} onChange={e=> setForm((s:any)=>({...s, youtubeUrl:e.target.value}))} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" loading={fetchingMeta} onClick={handleFetchMeta}>Auto-fill from Cloudflare /video</Button>
              <span className="text-xs text-ink-400 self-center">Uses ec-content-api health/video endpoint. No API key. Editable after fetch.</span>
            </div>
            <Input label="Title*" value={form.title} onChange={e=> setForm((s:any)=>({...s, title:e.target.value}))} required />
            <Textarea label="Description" value={form.description} onChange={e=> setForm((s:any)=>({...s, description:e.target.value}))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Target batch/series" value={form.parentId} onChange={e=> handleParentChange(e.target.value)}>
                <option value="">None (no enrolment gate)</option>
                {batches.map(b=> <option key={b.id} value={b.id}>Batch: {b.title}</option>)}
                {series.map(s=> <option key={s.id} value={s.id}>Series: {s.title}</option>)}
              </Select>
              <div>
                {form.parentId ? (
                  <div>
                    <Select
                      label="Subject"
                      value={form.subjectId}
                      required
                      onChange={e=> setForm((s:any)=>({...s, subjectId:e.target.value}))}
                    >
                      <option value="">Choose a subject…</option>
                      {subjectsForParent(form.parentId).map(subject=> (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </Select>
                    {subjectsForParent(form.parentId).length===0 ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        No subjects assigned to this course yet.{' '}
                        <Link href="/admin/subjects" className="font-semibold underline">Assign subjects</Link> before grouping lectures.
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-ink-500">Only subjects assigned to the selected course are listed.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-1.5">Subject</label>
                    <p className="rounded-xl border border-dashed border-ink-200 px-3 py-2 text-xs text-ink-500">
                      Choose a batch or series to enable subject assignment. Subjects are validated server-side.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Lesson/Topic" value={form.lesson} onChange={e=> setForm((s:any)=>({...s, lesson:e.target.value}))} placeholder="e.g. Electrostatics - Lecture 1" />
              <Input label="Topic tag" value={form.topic} onChange={e=> setForm((s:any)=>({...s, topic:e.target.value}))} placeholder="Shown in student filters" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Exam*" value={form.exam} onChange={e=> setForm((s:any)=>({...s, exam:e.target.value}))}><option>JEE</option><option>NEET</option><option>Both</option></Select>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Classes*</label>
                <div className="flex gap-2">{['11','12'].map(c=> <label key={c} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.classes.includes(c)} onChange={e=> setForm((s:any)=>({...s, classes: e.target.checked? [...s.classes,c]: s.classes.filter((x:string)=>x!==c)}))} />{c}</label>)}</div>
              </div>
            </div>
            <Input label="Thumbnail URL" placeholder="https://img.youtube.com/vi/.../hqdefault.jpg" value={form.thumbnailUrl} onChange={e=> setForm((s:any)=>({...s, thumbnailUrl:e.target.value}))} />

            <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
              <p className="text-sm font-semibold">Notes PDF (Google Drive)</p>
              <p className="text-[11px] text-ink-500 mt-0.5">
                PDFs are uploaded server-side to the private Drive folder and streamed to students only after an access check.
                Limit 20 MB, PDF only. A parent batch or series is required.
              </p>
              {form.notesFileId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  <span className="font-semibold">{form.notesFileName || 'Attached PDF'}</span>
                  <span className="text-emerald-700">stored in Drive, linked by file ID</span>
                  <button type="button" className="ml-auto font-bold text-red-700 hover:underline" onClick={()=> setForm((s:any)=>({...s, notesFileId:'', notesFileName:''}))}>
                    Detach
                  </button>
                </div>
              ) : null}
              {pdfUploading ? (
                <div className="mt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-valuenow={pdfProgress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-brand-600 transition-all" style={{ width: `${pdfProgress}%` }} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                    <span>Uploading… {pdfProgress}%</span>
                    <button type="button" className="font-bold text-red-600 hover:underline" onClick={()=> pdfAbortRef.current?.abort()}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    aria-label="Upload notes PDF"
                    className="block w-full max-w-xs text-xs"
                    disabled={!form.parentId}
                    onChange={e=> void handlePdfUpload(e.target.files?.[0])}
                  />
                  {courseFiles.length>0 && (
                    <Select label="" value="" onChange={e=> {
                      const picked = courseFiles.find(file=> file.id===e.target.value);
                      if(picked) setForm((s:any)=>({ ...s, notesFileId: picked.id, notesFileName: picked.displayName, notesPdfUrl:'' }));
                    }}>
                      <option value="">Attach an existing course PDF…</option>
                      {courseFiles.map(file=> <option key={file.id} value={file.id}>{file.displayName}</option>)}
                    </Select>
                  )}
                </div>
              )}
              {pdfError && <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{pdfError}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-ink-500">Use an external PDF link instead</summary>
                <Input label="Notes PDF URL" value={form.notesPdfUrl} onChange={e=> setForm((s:any)=>({...s, notesPdfUrl:e.target.value, notesFileId:''}))} />
              </details>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Duration label" placeholder="45:00" value={form.duration} onChange={e=> setForm((s:any)=>({...s, duration:e.target.value}))} />
              <Input label="Position/Order" type="number" value={form.position} onChange={e=> setForm((s:any)=>({...s, position:e.target.value}))} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPreview} onChange={e=> setForm((s:any)=>({...s, isPreview:e.target.checked}))} /> Preview (visible without enrolment)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=> setForm((s:any)=>({...s, active:e.target.checked}))} /> Active</label>
            <Input label="Access code (rare for lectures; usually on batch/series)" value={form.accessCode} onChange={e=> setForm((s:any)=>({...s, accessCode:e.target.value}))} />
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>{editing? 'Update':'Create'}</Button>
              <Button type="button" variant="outline" onClick={()=> setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function AdminTestsTab(){
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseCatalogItem|null>(null);
  const [form, setForm] = useState<any>({
    title:'', description:'', exam:'JEE', classes:['11'], active:true,
    subject:'', durationMinutes:'30', scheduledAt:'', endsAt:'', isLive:false, allowMultipleAttempts:false, marksPerQuestion:'4', negativeMarks:'1', questionsJson:''
  });
  const [validation, setValidation] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{ const data = await getAdminContentList({ kind:'test' }); setItems(data); }catch(e){ setError(e instanceof Error? e.message:'Failed'); } finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  function openCreate(){
    setEditing(null);
    setForm({ title:'', description:'', exam:'JEE', classes:['11'], active:true, subject:'', durationMinutes:'30', scheduledAt:'', endsAt:'', isLive:false, allowMultipleAttempts:false, marksPerQuestion:'4', negativeMarks:'1', questionsJson: JSON.stringify({ questions: [{ id:'q1', type:'single-choice', text:'Sample question', options:[{id:'A', text:'Option A'},{id:'B', text:'Option B'},{id:'C', text:'Option C'},{id:'D', text:'Option D'}], correctAnswer:'B', marks:4, negativeMarks:1, explanation:'Shown after submission' }] }, null, 2) });
    setValidation(null); setShowForm(true);
  }
  function openEdit(item: CourseCatalogItem){
    setEditing(item);
    const m = item.metadata as Record<string, any>;
    setForm({
      title:item.title, description:item.description, exam:item.exam, classes:item.classes, active:item.active,
      subject: m.subject||'', durationMinutes: String(m.durationMinutes||30), scheduledAt: m.scheduledAt? toISTDateTimeLocalInput(m.scheduledAt): (m.scheduled_at? toISTDateTimeLocalInput(m.scheduled_at):''), endsAt: m.endsAt? toISTDateTimeLocalInput(m.endsAt): (m.ends_at? toISTDateTimeLocalInput(m.ends_at):''), isLive: !!m.isLive, allowMultipleAttempts: !!m.allowMultipleAttempts, marksPerQuestion: String(m.marksPerQuestion||4), negativeMarks: String(m.negativeMarks||1), questionsJson: JSON.stringify({ questions: m.questions || [] }, null, 2)
    });
    setValidation(null); setShowForm(true);
  }

  function handleValidate(){
    const res = validateQuestionsJson(form.questionsJson);
    setValidation(res);
    if(res.valid) push(`Valid: ${res.questions.length} questions`,'success');
    else push(`Found ${res.errors.length} errors`,'error');
  }

  async function handleSave(e: React.FormEvent){
    e.preventDefault();
    const res = validateQuestionsJson(form.questionsJson);
    if(!res.valid){ setValidation(res); push('Fix validation errors before saving','error'); return; }
    if(!form.title.trim()){ push('Title required','error'); return; }
    setSaving(true);
    try{
      const scheduledAt = form.scheduledAt? fromISTDateTimeLocalInput(form.scheduledAt): null;
      const endsAt = form.endsAt? fromISTDateTimeLocalInput(form.endsAt): null;
      const metadata: Record<string,unknown> = {
        subject: form.subject || undefined,
        durationMinutes: Number(form.durationMinutes)||0,
        scheduledAt, endsAt, isLive: !!form.isLive, allowMultipleAttempts: !!form.allowMultipleAttempts,
        marksPerQuestion: Number(form.marksPerQuestion)||4, negativeMarks: Number(form.negativeMarks)||0,
        questions: res.questions,
        totalQuestions: res.questions.length, totalMarks: res.questions.reduce((s,q)=> s + (Number(q.marks)|| Number(form.marksPerQuestion)||4),0)
      };
      const payload = { kind:'test' as const, title: form.title.trim(), description: form.description.slice(0,10000), exam: form.exam, classes: form.classes, active: !!form.active, accessCode: null, metadata };
      if(editing) await updateAdminContent(editing.id, payload);
      else await createAdminContent(payload);
      push(editing?'Updated':'Created','success');
      setShowForm(false); load();
    }catch(err){ push(err instanceof Error? err.message:'Save failed','error'); }
    finally{ setSaving(false); }
  }

  async function handleDisable(id:string){
    if(!confirm('Disable this test?')) return;
    try{ await disableAdminContent(id); push('Disabled','success'); load(); }catch(err){ push(err instanceof Error? err.message:'Failed','error'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">Tests & Question Bank</h2><div className="flex gap-2"><Button variant="outline" onClick={load}>Refresh</Button><Button onClick={openCreate}>+ Create test</Button></div></div>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length===0 && <EmptyState title="No tests" description="Create a test with JSON bank, schedule and marks." />}

      <div className="grid gap-3">
        {items.map(it=>{
          const m = it.metadata as Record<string,any>;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{it.title} <Badge variant={it.active?'success':'danger'}>{it.active?'Active':'Disabled'}</Badge> <Badge>{it.exam}</Badge> <Badge>{it.classes.join('/')}</Badge> {m.isLive && <Badge variant="success">Live</Badge>}</p>
                  <p className="text-xs text-ink-500">{it.description}</p>
                  <p className="text-xs text-ink-400 mt-1">{m.subject||'—'} • {m.durationMinutes||0} min • {Array.isArray(m.questions)? m.questions.length: m.totalQuestions||0} Qs • Marks {m.marksPerQuestion||0} -{m.negativeMarks||0} • {m.scheduledAt? `Start ${m.scheduledAt}`:'No schedule'}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={()=> openEdit(it)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={()=> handleDisable(it.id)}>Disable</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card className="p-6 border-brand-200">
          <h3 className="font-bold mb-3">{editing? 'Edit':'Create'} test</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <Input label="Title*" value={form.title} onChange={e=> setForm((s:any)=>({...s, title:e.target.value}))} required />
            <Textarea label="Description" value={form.description} onChange={e=> setForm((s:any)=>({...s, description:e.target.value}))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Exam*" value={form.exam} onChange={e=> setForm((s:any)=>({...s, exam:e.target.value}))}><option>JEE</option><option>NEET</option><option>Both</option></Select>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Classes*</label>
                <div className="flex gap-2">{['11','12'].map(c=> <label key={c} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.classes.includes(c)} onChange={e=> setForm((s:any)=>({...s, classes: e.target.checked? [...s.classes,c]: s.classes.filter((x:string)=>x!==c)}))} />{c}</label>)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Subject" value={form.subject} onChange={e=> setForm((s:any)=>({...s, subject:e.target.value}))} placeholder="Physics/Chemistry/Biology/Maths" />
              <Input label="Duration minutes*" type="number" value={form.durationMinutes} onChange={e=> setForm((s:any)=>({...s, durationMinutes:e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Scheduled At (IST)" type="datetime-local" value={form.scheduledAt} onChange={e=> setForm((s:any)=>({...s, scheduledAt:e.target.value}))} />
              <Input label="Ends At (IST)" type="datetime-local" value={form.endsAt} onChange={e=> setForm((s:any)=>({...s, endsAt:e.target.value}))} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isLive} onChange={e=> setForm((s:any)=>({...s, isLive:e.target.checked}))} /> isLive</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowMultipleAttempts} onChange={e=> setForm((s:any)=>({...s, allowMultipleAttempts:e.target.checked}))} /> allowMultipleAttempts</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=> setForm((s:any)=>({...s, active:e.target.checked}))} /> Active</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Marks per question" type="number" value={form.marksPerQuestion} onChange={e=> setForm((s:any)=>({...s, marksPerQuestion:e.target.value}))} />
              <Input label="Negative marks" type="number" value={form.negativeMarks} onChange={e=> setForm((s:any)=>({...s, negativeMarks:e.target.value}))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Questions JSON* (paste or upload — preserves LaTeX)</label>
              <textarea value={form.questionsJson} onChange={e=> setForm((s:any)=>({...s, questionsJson:e.target.value}))} rows={10} className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-mono" placeholder='{"questions":[...]} or [...]' />
              <div className="flex gap-2 mt-2">
                <Button type="button" size="sm" variant="outline" onClick={handleValidate}>Validate</Button>
                <label className="px-3 py-1 bg-white border border-ink-200 rounded-xl text-sm cursor-pointer">Upload JSON<input type="file" accept=".json" className="hidden" onChange={e=> { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=> setForm((s:any)=>({...s, questionsJson: String(r.result)})); r.readAsText(f); }} /></label>
              </div>
              {validation && (
                <div className={`mt-2 p-3 rounded-xl text-xs ${validation.valid?'bg-emerald-50 border border-emerald-200 text-emerald-800':'bg-red-50 border border-red-200 text-red-700'}`}>
                  {validation.valid ? <p>✓ Valid — {validation.questions.length} questions ready. Keep keys private until backend result.</p> : (
                    <div>
                      {validation.globalError && <p className="font-semibold">{validation.globalError}</p>}
                      {validation.errors.map((er:any,i:number)=> <p key={i}>Row {er.row} ({er.questionId}): {er.message}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={saving}>{editing? 'Update':'Create'}</Button>
              <Button type="button" variant="outline" onClick={()=> setShowForm(false)}>Cancel</Button>
            </div>
            <p className="text-xs text-ink-400">Save as kind=test, metadata.questions. Never expose correctAnswer before submission.</p>
          </form>
        </Card>
      )}
    </div>
  );
}

function AdminAnnouncementsTab(){
  const { push } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [form, setForm] = useState({ title:'', body:'', audience:'All', active:true, scheduledAt:'' });
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{ const data = await getAdminAnnouncements(); setItems(data); }catch(e){ setError(e instanceof Error? e.message:'Failed'); } finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  function openCreate(){ setEditing(null); setForm({ title:'', body:'', audience:'All', active:true, scheduledAt:'' }); setShowForm(true); }
  function openEdit(a:any){ setEditing(a); setForm({ title:a.title, body:a.body, audience:a.audience, active:a.active, scheduledAt: a.scheduled_at? toISTDateTimeLocalInput(a.scheduled_at):'' }); setShowForm(true); }

  async function handleSave(e: React.FormEvent){
    e.preventDefault();
    const payload = { title: form.title, body: form.body, audience: form.audience, active: form.active, scheduledAt: form.scheduledAt? fromISTDateTimeLocalInput(form.scheduledAt): null };
    setSaving(true);
    try{
      if(editing) await updateAdminAnnouncement(editing.id, payload);
      else await createAdminAnnouncement(payload);
      push(editing?'Updated':'Created','success');
      setShowForm(false); load();
    }catch(err){ push(err instanceof Error? err.message:'Save failed','error'); }
    finally{ setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">Announcements</h2><div className="flex gap-2"><Button variant="outline" onClick={load}>Refresh</Button><Button onClick={openCreate}>+ New</Button></div></div>
      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length===0 && <EmptyState title="No announcements" description="Create text announcements (title, body, audience, schedule, active)." />}
      <div className="grid gap-3">
        {items.map(a=>(
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{a.title} <Badge variant={a.active?'success':'danger'}>{a.active?'Active':'Disabled'}</Badge> <Badge>{a.audience}</Badge></p>
                <p className="text-sm text-ink-600 mt-1">{a.body}</p>
                <p className="text-xs text-ink-400 mt-1">Scheduled: {a.scheduled_at || 'now'} • Created {a.created_at}</p>
              </div>
              <Button size="sm" variant="outline" onClick={()=> openEdit(a)}>Edit</Button>
            </div>
          </Card>
        ))}
      </div>
      {showForm && (
        <Card className="p-6">
          <h3 className="font-bold mb-3">{editing? 'Edit':'Create'} announcement</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <Input label="Title*" value={form.title} onChange={e=> setForm(s=>({...s, title:e.target.value}))} required />
            <Textarea label="Body*" value={form.body} onChange={e=> setForm(s=>({...s, body:e.target.value}))} rows={3} required />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Audience" value={form.audience} onChange={e=> setForm(s=>({...s, audience:e.target.value}))}><option>All</option><option>JEE</option><option>NEET</option><option>JEE 11</option><option>NEET 12</option></Select>
              <Input label="Scheduled At (IST)" type="datetime-local" value={form.scheduledAt} onChange={e=> setForm(s=>({...s, scheduledAt:e.target.value}))} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=> setForm(s=>({...s, active:e.target.checked}))} /> Active</label>
            <div className="flex gap-2"><Button type="submit" loading={saving}>{editing? 'Update':'Create'}</Button><Button type="button" variant="outline" onClick={()=> setShowForm(false)}>Cancel</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}

function AdminStudentsTab(){
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [filter, setFilter] = useState('');
  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{ const data = await getAdminStudents(); setStudents(data); }catch(e){ setError(e instanceof Error? e.message:'Failed'); } finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);
  const filtered = students.filter(s=> !filter || s.display_name?.toLowerCase().includes(filter.toLowerCase()) || s.email?.toLowerCase().includes(filter.toLowerCase()) || s.exam?.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">Students</h2><Button variant="outline" onClick={load}>Refresh</Button></div>
      <Input placeholder="Search by name, email, exam..." value={filter} onChange={e=> setFilter(e.target.value)} />
      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && filtered.length===0 && <EmptyState title="No students" description="Students appear after onboarding via POST /profile. Filter/search by name, exam/class." />}
      <div className="grid gap-2">
        {filtered.map(s=>(
          <Card key={s.firebase_uid} className="p-3 flex items-center gap-3">
            <ProfileImage src={s.avatar_url} name={s.display_name} className="h-10 w-10" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{s.display_name} <Badge>{s.exam}</Badge> <Badge>Class {s.class_level}</Badge></p>
              <p className="text-xs text-ink-500 truncate">{s.email} • UID {s.firebase_uid.slice(0,8)} • {new Date(s.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-ink-400">Never display service secrets or include sensitive values in client logs.</p>
    </div>
  );
}

export function AdminFeedbackTab(){
  const { user } = useAuth();
  const { push } = useToast();
  const [threads, setThreads] = useState<any[]>([]);
  const [selected, setSelected] = useState<string|null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(()=>{
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import('@/lib/app-data').then(({ subscribeToAllStudentThreads }) => {
      if (!cancelled) unsub = subscribeToAllStudentThreads(setThreads);
    }).catch(() => {
      if (!cancelled) push('Unable to load student feedback', 'error');
    });
    return () => { cancelled = true; unsub?.(); };
  },[push]);

  useEffect(()=>{
    if(!selected || !user) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import('@/lib/app-data').then(({ subscribeToFeedbackMessages }) => {
      if (!cancelled) unsub = subscribeToFeedbackMessages(selected, setMessages);
    }).catch(() => {
      if (!cancelled) push('Unable to load feedback details', 'error');
    });
    return () => { cancelled = true; unsub?.(); };
  },[selected, user, push]);

  async function handleReply(e: React.FormEvent){
    e.preventDefault();
    if(!selected || !user || !reply.trim()) return;
    if(reply.length>5000){ push('Message too long','error'); return; }
    setSending(true);
    try{ const { sendStudentMessage } = await import('@/lib/app-data'); await sendStudentMessage(selected, reply.trim(), 'admin', user.uid); setReply(''); push('Replied','success'); }catch(err){ push(err instanceof Error? err.message:'Failed','error'); } finally{ setSending(false); }
  }

  return (
    <div className="grid md:grid-cols-[340px_1fr] gap-4">
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between"><h3 className="font-semibold">Feedback inbox</h3><Badge>{threads.length}</Badge></div>
        <div className="max-h-[60vh] overflow-auto">
          {threads.length===0 && <p className="p-4 text-sm text-ink-500 text-center">No feedback submitted yet</p>}
          {threads.map(t=>(
            <button key={t.id} onClick={()=> setSelected(t.id)} className={`w-full text-left p-3 border-b border-ink-100 hover:bg-ink-50 ${selected===t.id?'bg-brand-50':''}`}>
              <p className="font-semibold text-sm truncate">{t.studentName || t.studentUid.slice(0,8)} {t.unreadByAdmin && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500" />}</p>
              <p className="text-xs text-ink-500 truncate">{t.lastMessageText || 'No messages'}</p>
              <p className="text-[11px] text-ink-400">{t.lastMessageAt? new Date(t.lastMessageAt).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'}) : ''} • {t.exam||''} {t.classLevel||''}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col min-h-[60vh]">
        {!selected ? <div className="flex-1 grid place-items-center text-sm text-ink-500">Select a feedback item to review and respond. Feedback and replies are stored in Cloudflare D1.</div> : (
          <>
            <div className="p-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between"><h3 className="font-semibold">Feedback • {selected.slice(0,8)}</h3><Badge variant="info">Admin</Badge></div>
            <div className="flex-1 overflow-auto p-4 space-y-3 bg-ink-50">
              {messages.map(m=>(
                <div key={m.id} className={`flex ${m.senderRole==='admin' ? 'justify-end':'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.senderRole==='admin' ? 'bg-ink-900 text-white rounded-br-sm':'bg-white border border-ink-200 rounded-bl-sm'}`}>
                    <p>{m.text}</p>
                    <p className="text-[10px] opacity-60 mt-1">{new Date(m.createdAt).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'})}</p>
                  </div>
                </div>
              ))}
              {messages.length===0 && <p className="text-sm text-ink-500 text-center py-10">No messages in this thread.</p>}
            </div>
            <form onSubmit={handleReply} className="p-3 border-t border-ink-100 flex gap-2 bg-white">
              <input value={reply} onChange={e=> setReply(e.target.value)} placeholder="Reply to feedback..." maxLength={5000} className="flex-1 rounded-full border border-ink-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <Button type="submit" loading={sending}>Send</Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
