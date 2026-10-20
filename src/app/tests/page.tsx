'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { getStudentTests } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { formatISTDateTime } from '@/lib/date';
import { useAuth } from '@/context/AuthContext';

type Filter = 'all'|'live'|'upcoming'|'completed';

export default function TestsPage(){
  const { profile } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'soonest'|'title'>('soonest');

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const data = await getStudentTests();
      setTests(data);
    }catch(e){ setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const now = Date.now();
  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    const list = tests.filter(t=>{
      if(q && !`${t.title} ${t.description} ${t.subject || ''}`.toLowerCase().includes(q)) return false;
      if(filter==='all') return true;
      if(filter==='live') return t.isLive;
      if(filter==='upcoming') return !t.isLive && t.scheduledAt && new Date(t.scheduledAt).getTime() > now;
      if(filter==='completed') return t.endsAt && new Date(t.endsAt).getTime() < now;
      return true;
    });
    return sort === 'title'
      ? [...list].sort((a,b)=> a.title.localeCompare(b.title))
      : [...list].sort((a,b)=> {
          const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });
  },[tests, filter, query, sort, now]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tests</h1>
        <p className="text-sm text-ink-500">Live, upcoming, expired and completed. Filtered for {profile?.exam} • Class {profile?.class_level}. Official scores are server-calculated.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search tests…" className="ec-field !py-2 !text-xs !w-auto flex-1 min-w-[200px]" />
        <select value={sort} onChange={(e)=>setSort(e.target.value as 'soonest'|'title')} className="ec-field !py-2 !text-xs !w-auto">
          <option value="soonest">Soonest first</option>
          <option value="title">A–Z</option>
        </select>
        {(['all','live','upcoming','completed'] as Filter[]).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-4 py-2 rounded-full text-sm font-semibold border ${filter===f?'bg-ink-900 text-white border-ink-900':'bg-white text-ink-700 border-ink-200'}`}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm">Refresh</button>
      </div>

      {loading && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i=> <Skeleton key={i} className="h-40" />)}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}
      {!loading && !error && filtered.length===0 && <EmptyState title="No tests in this filter" description="Admin can create tests from Dashboard → Tests with schedule, duration, marks and JSON question bank." action={<Link href="/admin" className="px-4 py-2 bg-ink-900 text-white rounded-xl text-sm font-semibold">Go to admin</Link>} />}
      {!loading && !error && filtered.length>0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t=>(
            <Card key={t.id} className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2">{t.title}</h3>
                <Badge variant={t.isLive?'success': t.endsAt && new Date(t.endsAt).getTime()<now ? 'danger':'info'}>{t.isLive?'Live': t.endsAt && new Date(t.endsAt).getTime()<now ? 'Ended':'Scheduled'}</Badge>
              </div>
              <p className="text-xs text-ink-500 line-clamp-2 mt-1">{t.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.subject && <Badge>{t.subject}</Badge>}
                <Badge variant="default">{t.durationMinutes || 0} min</Badge>
                <Badge variant="default">{t.totalQuestions} Qs</Badge>
                <Badge variant="default">{t.exam} • {t.classes.join('/')}</Badge>
              </div>
              <p className="text-[11px] text-ink-400 mt-2">{t.scheduledAt ? `Start: ${formatISTDateTime(t.scheduledAt)}`: 'No start'}<br/>{t.endsAt ? `End: ${formatISTDateTime(t.endsAt)}`:''}</p>
              <div className="flex gap-2 mt-3">
                <Link href={`/tests/${t.id}`} className="flex-1 px-3 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl text-center">Open test</Link>
                <Link href={`/leaderboard?testId=${t.id}`} className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm font-semibold">Leaderboard</Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 bg-ink-50 border-dashed text-xs text-ink-500">
        <p>GET /tests and GET /tests/:id never expose answer keys before submission. POST /tests/:id/submit is server-authoritative. Timer, navigation and draft persistence handled client-side; expired/duplicate attempts handled visibly.</p>
      </Card>
    </div>
  );
}
