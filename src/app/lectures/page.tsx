'use client';
import { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getCatalogContent, enrollInBatchOrSeries, ApiError } from '@/lib/api';
import { Card, CardBody, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import type { CourseCatalogItem } from '@/types';
import { isSafeHttpUrl } from '@/lib/validation';

type Tab = 'batches'|'series'|'lectures'|'resources';

function LecturesHubPageInner(){
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { profile, user } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('batches');
  const [items, setItems] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [filter, setFilter] = useState(initialQuery);
  const [sort, setSort] = useState<'newest'|'title'>('newest');
  const [enrollCodes, setEnrollCodes] = useState<Record<string,string>>({});
  const [enrolling, setEnrolling] = useState<string|null>(null);
  const [myEnrollments, setMyEnrollments] = useState<Set<string>>(new Set());

  const load = useCallback(async ()=>{
    if(!profile) return;
    setLoading(true); setError(null);
    try{
      const kind = tab==='batches' ? 'batch' : tab==='series' ? 'series' : tab;
      const data = await getCatalogContent({ kind: kind as any });
      setItems(data);
    }catch(e){
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally{ setLoading(false); }
  },[profile, tab]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ setFilter(initialQuery); },[initialQuery]);
  useEffect(()=>{
    const kindParam = searchParams.get('kind');
    if(kindParam === 'batch') setTab('batches');
    else if(kindParam === 'series') setTab('series');
    else if(kindParam === 'resources') setTab('resources');
    else if(kindParam === 'lectures') setTab('lectures');
  },[searchParams]);

  async function handleEnroll(item: CourseCatalogItem){
    const code = enrollCodes[item.id] || '';
    setEnrolling(item.id);
    try{
      await enrollInBatchOrSeries({ itemType: item.kind as 'batch'|'series', itemId: item.id, accessCode: code || undefined });
      setMyEnrollments(s=> new Set([...Array.from(s), item.id]));
      push('Enrolled successfully','success');
    }catch(e){
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Enrollment failed';
      push(msg,'error');
    } finally{ setEnrolling(null); }
  }

  const filtered = useMemo(()=>{
    const q = filter.trim().toLowerCase();
    const list = items.filter(i=> !q || `${i.title} ${i.description} ${(i.metadata as Record<string,unknown>)?.subject || ''} ${(i.metadata as Record<string,unknown>)?.topic || ''}`.toLowerCase().includes(q));
    return sort === 'title' ? [...list].sort((a,b)=> a.title.localeCompare(b.title)) : [...list].sort((a,b)=> b.updated_at.localeCompare(a.updated_at));
  }, [items, filter, sort]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lectures & Batches</h1>
          <p className="text-sm text-ink-500">Browse All Batches, My Batches, Series and Lessons. Content filtered for {profile?.exam} • Class {profile?.class_level}</p>
        </div>
        <Link href="/lectures" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm">Refresh</Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(['batches','series','lectures','resources'] as Tab[]).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-full text-sm font-semibold border ${tab===t ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-700 border-ink-200'}`}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[220px]">
          <Input placeholder={`Search ${tab}...`} value={filter} onChange={e=>setFilter(e.target.value)} />
        </div>
        <select className="ec-field !py-2 !text-xs !w-auto" value={sort} onChange={(e)=>setSort(e.target.value as 'newest'|'title')}>
          <option value="newest">Newest first</option>
          <option value="title">A–Z</option>
        </select>
        <span className="text-[11px] text-ink-500">{filtered.length} result{filtered.length===1?'':'s'}</span>
      </div>

      {loading && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i=> <Skeleton key={i} className="h-48" />)}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Retry</Button></div>}
      {!loading && !error && filtered.length===0 && (
        <EmptyState title={`No ${tab} yet`} description={`No ${tab} match your exam/class. Admin can add ${tab} from Dashboard → Lectures.`} />
      )}

      {!loading && !error && filtered.length>0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item=>{
            const meta = item.metadata as Record<string, unknown>;
            const thumb = (meta.thumbnailUrl as string) || (meta.thumbnail_url as string) || (tab==='lectures' ? `https://img.youtube.com/vi/${meta.videoId as string}/hqdefault.jpg` : '');
            const needsCode = Boolean(item.hasAccessCode);
            const codeValue = enrollCodes[item.id] || '';
            return (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                {thumb && isSafeHttpUrl(thumb) ? <img src={thumb} alt={item.title} className="w-full h-40 object-cover bg-ink-100" loading="lazy" /> : <div className="w-full h-40 bg-gradient-to-br from-brand-50 to-ink-100 grid place-items-center text-ink-400 text-sm">No thumbnail</div>}
                <CardBody className="flex-1 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">{item.title}</h3>
                    <Badge variant={item.active ? 'success':'danger'}>{item.active?'Active':'Disabled'}</Badge>
                  </div>
                  <p className="text-xs text-ink-500 line-clamp-2">{item.description || '—'}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge>{item.exam}</Badge><Badge>Class {item.classes.join('/')}</Badge>
                    {needsCode && <Badge variant="warning">Access code required</Badge>}
                    {(meta.isPreview as boolean) && <Badge variant="success">Preview</Badge>}
                  </div>
                  {(tab==='batches' || tab==='series') && (
                    <div className="mt-2 space-y-2">
                      {needsCode && (
                        <Input placeholder="Enter access code" value={codeValue} onChange={e=> setEnrollCodes(s=> ({...s, [item.id]: e.target.value}))} />
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" loading={enrolling===item.id} onClick={()=>handleEnroll(item)} className="flex-1">{myEnrollments.has(item.id) ? 'Enrolled ✓' : needsCode ? 'Enroll with code' : 'Enroll'}</Button>
                        <Link href={`/lectures/${item.id}`} className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm font-semibold text-center flex-1">View</Link>
                      </div>
                      <p className="text-[11px] text-ink-400">Access code is validated server-side; wrong code never creates enrollment.</p>
                    </div>
                  )}
                  {tab==='lectures' && (
                    <div className="flex gap-2 mt-2">
                      <Link href={`/lectures/${item.id}`} className="flex-1 px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold text-center">Watch</Link>
                      {(meta.notesPdfUrl as unknown as string) && isSafeHttpUrl(meta.notesPdfUrl as unknown as string) && <a href={meta.notesPdfUrl as unknown as string} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm font-semibold">PDF</a>}
                    </div>
                  )}
                  {tab==='resources' && (
                    <div className="flex gap-2 mt-2">
                      {(meta.pdfUrl as unknown as string) && isSafeHttpUrl(meta.pdfUrl as unknown as string) ? (
                        <a href={meta.pdfUrl as unknown as string} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 bg-ink-900 text-white rounded-xl text-sm font-semibold text-center">Open PDF</a>
                      ): <span className="text-xs text-ink-400">No PDF URL</span>}
                    </div>
                  )}
                  <p className="text-[11px] text-ink-400 mt-1">ID {item.id.slice(0,8)} • {new Date(item.updated_at).toLocaleDateString('en-IN')}</p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4 bg-amber-50 border-amber-200">
        <p className="text-sm font-semibold text-amber-900">Enrolment & access</p>
        <p className="text-xs text-amber-800 mt-1">Lessons/resources with parentId pointing to a batch/series are restricted to active enrollees, except explicitly marked preview. Server enforces enrolment; UI never fakes security.</p>
      </Card>
    </div>
  );
}

export default function LecturesHubPage(){
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto space-y-4"><div className="ec-skeleton h-10 w-64" /><div className="ec-skeleton h-48 w-full" /></div>}>
      <LecturesHubPageInner />
    </Suspense>
  );
}
