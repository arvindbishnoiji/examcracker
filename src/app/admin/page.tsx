'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import {
  getAdminOverview, getAdminContentList, createAdminContent, updateAdminContent, disableAdminContent,
  getAdminAnnouncements, createAdminAnnouncement, updateAdminAnnouncement, getAdminStudents,
} from '@/lib/api';
import { fetchVideoMetadata, importFullYoutubePlaylist, extractYoutubeVideoId, extractYoutubePlaylistId, getYoutubeDefaultThumbnail } from '@/lib/mediaProxy';
import { fromISTDateTimeLocalInput, toISTDateTimeLocalInput } from '@/lib/date';
import { isSafeHttpUrl, validateQuestionsJson } from '@/lib/validation';
import type { CourseCatalogItem } from '@/types';

type AdminTab = 'overview'|'goals'|'batches'|'lectures'|'series'|'tests'|'events'|'announcements'|'students'|'chat';

export default function AdminPage(){
  const { user, isAdmin, initializing } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');
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
    {id:'chat', label:'Chat'},
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-ink-500">Protected — server verifies Firebase ID token email == arvinddarabishnoi@gmail.com. No public admin registration.</p>
        </div>
        <Badge variant="info">Admin: {user.email}</Badge>
      </div>

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
        {tab==='chat' && <AdminChatTab />}
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

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const data = await getAdminContentList({ kind });
      setItems(data);
    }catch(e){ setError(e instanceof Error? e.message:'Failed'); }
    finally{ setLoading(false); }
  },[kind]);
  useEffect(()=>{ load(); },[load]);

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
      load();
    }catch(err){ push(err instanceof Error? err.message:'Save failed','error'); }
    finally{ setSaving(false); }
  }

  async function handleDisable(id:string){
    if(!confirm('Disable (active=false) this item? This is soft-disable, not delete.')) return;
    try{ await disableAdminContent(id); push('Disabled','success'); load(); }catch(err){ push(err instanceof Error? err.message:'Failed','error'); }
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
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && !error && items.length===0 && <EmptyState title={`No ${kind}s yet`} description={`Create your first ${kind} — exam, class, title, description, active flag and metadata fields.`} />}

      <div className="grid gap-3">
        {items.map(it=>{
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

function AdminLecturesTab(){
  const { push } = useToast();
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [batches, setBatches] = useState<CourseCatalogItem[]>([]);
  const [series, setSeries] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [form, setForm] = useState<any>({
    title:'', description:'', exam:'JEE', classes:['11'], active:true, accessCode:'',
    youtubeUrl:'', videoId:'', thumbnailUrl:'', lesson:'', topic:'', notesPdfUrl:'', isPreview:false, parentId:'', position:'', duration:''
  });
  const [editing, setEditing] = useState<CourseCatalogItem|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistTarget, setPlaylistTarget] = useState('');
  const [playlistExam, setPlaylistExam] = useState('JEE');
  const [playlistClasses, setPlaylistClasses] = useState<string[]>(['11']);
  const [playlistTopic, setPlaylistTopic] = useState('');

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const [lectures, b, s] = await Promise.all([
        getAdminContentList({ kind:'lecture' }),
        getAdminContentList({ kind:'batch' }),
        getAdminContentList({ kind:'series' }),
      ]);
      setItems(lectures); setBatches(b); setSeries(s);
    }catch(e){ setError(e instanceof Error? e.message:'Failed'); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  function openCreate(){
    setEditing(null);
    setForm({ title:'', description:'', exam:'JEE', classes:['11'], active:true, accessCode:'', youtubeUrl:'', videoId:'', thumbnailUrl:'', lesson:'', topic:'', notesPdfUrl:'', isPreview:false, parentId:'', position:'', duration:'' });
    setShowForm(true);
  }
  function openEdit(item: CourseCatalogItem){
    setEditing(item);
    const m = item.metadata as Record<string,any>;
    setForm({
      title:item.title, description:item.description, exam:item.exam, classes:item.classes, active:item.active, accessCode:(item as any).access_code||'',
      youtubeUrl: m.youtubeUrl||'', videoId: m.videoId||'', thumbnailUrl: m.thumbnailUrl||'', lesson: m.lesson||'', topic: m.topic||'', notesPdfUrl: m.notesPdfUrl||'', isPreview: !!m.isPreview, parentId: m.parentId||'', position: m.position||'', duration: m.duration||''
    });
    setShowForm(true);
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
        lesson: form.lesson || undefined,
        topic: form.topic || undefined,
        notesPdfUrl: form.notesPdfUrl || undefined,
        isPreview: !!form.isPreview,
        playlistId: form.playlistId || undefined,
      };
      const payload = { kind:'lecture' as const, title: form.title.trim(), description: form.description.slice(0,10000), exam: form.exam, classes: form.classes, active: !!form.active, accessCode: form.accessCode||null, metadata };
      if(editing) await updateAdminContent(editing.id, payload);
      else await createAdminContent(payload);
      push(editing?'Updated':'Created','success');
      setShowForm(false); load();
    }catch(err){ push(err instanceof Error? err.message:'Save failed','error'); }
    finally{ setSaving(false); }
  }

  async function handleDisable(id:string){
    if(!confirm('Disable this lecture?')) return;
    try{ await disableAdminContent(id); push('Disabled','success'); load(); }catch(err){ push(err instanceof Error? err.message:'Failed','error'); }
  }

  async function handlePlaylistImport(){
    if(!playlistUrl.trim()){ push('Paste YouTube playlist URL','error'); return; }
    const pid = extractYoutubePlaylistId(playlistUrl);
    if(!pid){ push('Invalid playlist URL (needs list= param)','error'); return; }
    setPlaylistLoading(true);
    setPlaylistItems([]); setPlaylistTitle('');
    try{
      const res = await importFullYoutubePlaylist(playlistUrl, {
        onProgress: (p)=> { /* progress */ }
      });
      setPlaylistItems(res.items);
      setPlaylistTitle(res.title);
      push(`Imported ${res.items.length} videos in ${res.pagesFetched} pages (deduplicated)`, 'success');
    }catch(e){ push(e instanceof Error? e.message:'Playlist import failed. Try manual add.','error'); }
    finally{ setPlaylistLoading(false); }
  }

  async function handlePlaylistSave(){
    if(!playlistItems.length){ push('No items to save','error'); return; }
    if(!playlistTarget){ push('Select target batch/series','error'); return; }
    const selectedItems = playlistItems.filter((i:any)=> i.selected!==false);
    if(!selectedItems.length){ push('Select at least one video','error'); return; }
    setSaving(true);
    let ok=0, fail=0;
    for(const it of selectedItems){
      try{
        const metadata = {
          youtubeUrl: it.watchUrl, videoId: it.videoId, thumbnailUrl: it.thumbnail, duration: it.duration, position: it.position, parentId: playlistTarget, lesson: playlistTopic || playlistTitle, topic: playlistTopic || playlistTitle, isPreview:false, playlistId: extractYoutubePlaylistId(playlistUrl)
        };
        await createAdminContent({ kind:'lecture', title: it.title, description: it.description || `Imported from playlist ${playlistTitle}`, exam: playlistExam as any, classes: playlistClasses as any, active:true, accessCode:null, metadata });
        ok++;
      }catch{ fail++; }
    }
    push(`Saved ${ok} lectures${fail? `, ${fail} failed`:''}`,'success');
    setSaving(false);
    if(ok) load();
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
          <Button loading={playlistLoading} onClick={handlePlaylistImport}>Import</Button>
        </div>
        {playlistItems.length>0 && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <Select label="Target batch/series" value={playlistTarget} onChange={e=> setPlaylistTarget(e.target.value)}>
                <option value="">Select target</option>
                {batches.map(b=> <option key={b.id} value={b.id}>Batch: {b.title}</option>)}
                {series.map(s=> <option key={s.id} value={s.id}>Series: {s.title}</option>)}
              </Select>
              <Select label="Exam" value={playlistExam} onChange={e=> setPlaylistExam(e.target.value)}><option>JEE</option><option>NEET</option><option>Both</option></Select>
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
                  <img src={it.thumbnail} alt={it.title} className="h-14 w-20 rounded object-cover bg-ink-100" />
                  <div className="flex-1 min-w-0">
                    <input value={it.title} onChange={e=> setPlaylistItems(s=> s.map((x,i)=> i===idx? {...x, title:e.target.value}:x))} className="w-full text-sm font-medium bg-transparent border-b border-transparent focus:border-brand-300 focus:outline-none" />
                    <p className="text-xs text-ink-500">{it.videoId} • {it.duration}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handlePlaylistSave} loading={saving}>Save {playlistItems.filter((i:any)=> i.selected!==false).length} lectures to target</Button>
            <p className="text-xs text-ink-400">Never silently save half-import. Preserve failed URLs and allow manual add. Uses public YouTube page metadata.</p>
          </div>
        )}
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && items.length===0 && <EmptyState title="No lectures yet" description="Add lectures manually or via playlist import. Exam/class parentId enrolment respects server gate." />}

      <div className="grid gap-3">
        {items.map(it=>{
          const m = it.metadata as Record<string,any>;
          return (
            <Card key={it.id} className="p-4">
              <div className="flex gap-3">
                <img src={m.thumbnailUrl || (m.videoId? getYoutubeDefaultThumbnail(m.videoId):'https://via.placeholder.co/120x68')} alt={it.title} className="h-16 w-28 rounded-xl object-cover bg-ink-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{it.title} <Badge variant={it.active?'success':'danger'}>{it.active?'Active':'Disabled'}</Badge> <Badge>{it.exam}</Badge> <Badge>{it.classes.join('/')}</Badge></p>
                  <p className="text-xs text-ink-500 line-clamp-2">{it.description}</p>
                  <p className="text-xs text-ink-400 mt-1">Video {m.videoId || '—'} • Parent {m.parentId? m.parentId.slice(0,8):'—'} • Lesson {m.lesson||'—'} • {m.isPreview?'Preview':''}</p>
                  {m.notesPdfUrl && <a href={m.notesPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600">PDF →</a>}
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
              <Select label="Target batch/series" value={form.parentId} onChange={e=> setForm((s:any)=>({...s, parentId:e.target.value}))}>
                <option value="">None (no enrolment gate)</option>
                {batches.map(b=> <option key={b.id} value={b.id}>Batch: {b.title}</option>)}
                {series.map(s=> <option key={s.id} value={s.id}>Series: {s.title}</option>)}
              </Select>
              <Input label="Lesson/Topic" value={form.lesson} onChange={e=> setForm((s:any)=>({...s, lesson:e.target.value}))} placeholder="e.g. Electrostatics - Lecture 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Exam*" value={form.exam} onChange={e=> setForm((s:any)=>({...s, exam:e.target.value}))}><option>JEE</option><option>NEET</option><option>Both</option></Select>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Classes*</label>
                <div className="flex gap-2">{['11','12'].map(c=> <label key={c} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.classes.includes(c)} onChange={e=> setForm((s:any)=>({...s, classes: e.target.checked? [...s.classes,c]: s.classes.filter((x:string)=>x!==c)}))} />{c}</label>)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Thumbnail URL" placeholder="https://img.youtube.com/vi/.../hqdefault.jpg" value={form.thumbnailUrl} onChange={e=> setForm((s:any)=>({...s, thumbnailUrl:e.target.value}))} />
              <Input label="Notes PDF URL" value={form.notesPdfUrl} onChange={e=> setForm((s:any)=>({...s, notesPdfUrl:e.target.value}))} />
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
            <img src={s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.display_name||'Student')}`} alt={s.display_name} className="h-10 w-10 rounded-full" />
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

function AdminChatTab(){
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
    import('@/lib/firestore').then(({ subscribeToAllStudentThreads }) => {
      if (!cancelled) unsub = subscribeToAllStudentThreads(setThreads);
    }).catch(() => {
      if (!cancelled) push('Unable to load live student threads', 'error');
    });
    return () => { cancelled = true; unsub?.(); };
  },[push]);

  useEffect(()=>{
    if(!selected || !user) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import('@/lib/firestore').then(({ subscribeToStudentMessages }) => {
      if (!cancelled) unsub = subscribeToStudentMessages(selected, setMessages);
    }).catch(() => {
      if (!cancelled) push('Unable to load student messages', 'error');
    });
    return () => { cancelled = true; unsub?.(); };
  },[selected, user, push]);

  async function handleReply(e: React.FormEvent){
    e.preventDefault();
    if(!selected || !user || !reply.trim()) return;
    if(reply.length>5000){ push('Message too long','error'); return; }
    setSending(true);
    try{ const { sendStudentMessage } = await import('@/lib/firestore'); await sendStudentMessage(selected, reply.trim(), 'admin', user.uid); setReply(''); push('Replied','success'); }catch(err){ push(err instanceof Error? err.message:'Failed','error'); } finally{ setSending(false); }
  }

  return (
    <div className="grid md:grid-cols-[340px_1fr] gap-4">
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between"><h3 className="font-semibold">Student threads</h3><Badge>{threads.length}</Badge></div>
        <div className="max-h-[60vh] overflow-auto">
          {threads.length===0 && <p className="p-4 text-sm text-ink-500 text-center">No threads yet</p>}
          {threads.map(t=>(
            <button key={t.id} onClick={()=> setSelected(t.studentUid)} className={`w-full text-left p-3 border-b border-ink-100 hover:bg-ink-50 ${selected===t.studentUid?'bg-brand-50':''}`}>
              <p className="font-semibold text-sm truncate">{t.studentName || t.studentUid.slice(0,8)} {t.unreadByAdmin && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500" />}</p>
              <p className="text-xs text-ink-500 truncate">{t.lastMessageText || 'No messages'}</p>
              <p className="text-[11px] text-ink-400">{t.lastMessageAt? new Date(t.lastMessageAt).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'}) : ''} • {t.exam||''} {t.classLevel||''}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden flex flex-col min-h-[60vh]">
        {!selected ? <div className="flex-1 grid place-items-center text-sm text-ink-500">Select a student to view chat (admin can read/respond to all threads per Firestore rules).</div> : (
          <>
            <div className="p-3 border-b border-ink-100 bg-ink-50 flex items-center justify-between"><h3 className="font-semibold">Chat • {selected.slice(0,8)}</h3><Badge variant="info">Admin</Badge></div>
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
              <input value={reply} onChange={e=> setReply(e.target.value)} placeholder="Reply as admin..." maxLength={5000} className="flex-1 rounded-full border border-ink-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <Button type="submit" loading={sending}>Send</Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
