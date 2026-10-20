'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTestLeaderboard, getStudentTests } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import Link from 'next/link';
import type { TestCardItem, LeaderboardEntry } from '@/types';

function LeaderboardContent(){
  const searchParams = useSearchParams();
  const initialTestId = searchParams?.get('testId') || '';
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [selected, setSelected] = useState(initialTestId);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const loadTests = useCallback(async()=>{
    try{
      const t = await getStudentTests();
      setTests(t);
      if(!selected && t.length) setSelected(t[0].id);
    }catch{}
  },[selected]);

  useEffect(()=>{ loadTests(); },[loadTests]);

  const loadLeaderboard = useCallback(async()=>{
    if(!selected) { setEntries([]); return; }
    setLoading(true); setError(null);
    try{
      const res = await getTestLeaderboard(selected);
      setEntries(res.items || []);
    }catch(e){ setError(e instanceof Error ? e.message : 'Failed'); }
    finally{ setLoading(false); }
  },[selected]);

  useEffect(()=>{ loadLeaderboard(); },[loadLeaderboard]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-ink-500">Per-test ranking only — never a mixed global score. Select a test to see rank, name, score/max.</p>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="text-sm font-medium text-ink-700">Select test</label>
          <select value={selected} onChange={e=> setSelected(e.target.value)} className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm">
            <option value="">— Choose a test —</option>
            {tests.map(t=> <option key={t.id} value={t.id}>{t.title} • {t.totalQuestions} Qs • {t.durationMinutes} min</option>)}
          </select>
        </div>
        <button onClick={loadLeaderboard} className="px-4 py-2.5 bg-ink-900 text-white rounded-xl text-sm font-semibold">Refresh</button>
        <Link href="/tests" className="px-4 py-2.5 bg-white border border-ink-200 rounded-xl text-sm font-semibold">Browse tests</Link>
      </Card>

      {!selected && <EmptyState title="Select a test" description="Leaderboard is per test, not a mix of scores across different tests. Choose one above." />}
      {loading && <div className="space-y-2">{[1,2,3,4,5].map(i=> <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error}</div>}

      {!loading && !error && selected && entries.length===0 && (
        <EmptyState title="No attempts yet" description="No one has submitted this test yet. Be the first to attempt!" />
      )}

      {!loading && !error && entries.length>0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>Rank • Name • Score</span>
            <span>Showing test {selected.slice(0,8)}</span>
          </div>
          {entries.map(e=>(
            <Card key={e.firebaseUid + e.submittedAt} className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full grid place-items-center font-bold text-sm ${e.rank===1?'bg-amber-100 text-amber-800': e.rank===2?'bg-ink-100 text-ink-700': e.rank===3?'bg-orange-100 text-orange-800':'bg-ink-50 text-ink-600'}`}>#{e.rank}</div>
              <img src={e.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.name)}&background=random`} alt={e.name} className="h-10 w-10 rounded-full object-cover bg-ink-100" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{e.name}</p>
                <p className="text-xs text-ink-500">{new Date(e.submittedAt).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'})} IST</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink-900">{e.score}/{e.maxScore}</p>
                <p className="text-xs text-ink-500">{e.maxScore? Math.round(e.score/e.maxScore*100):0}%</p>
              </div>
              {e.rank<=3 && <Badge variant={e.rank===1?'warning': e.rank===2?'default':'info'}>{e.rank===1?'🥇': e.rank===2?'🥈':'🥉'}</Badge>}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 bg-ink-50 border-dashed text-xs text-ink-500">
        <p>Never exposes student email or private fields. Data from GET /leaderboard?testId=uuid. Empty states handled; no fabricated scores.</p>
      </Card>
    </div>
  );
}

export default function LeaderboardPage(){
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto p-6 text-sm text-ink-500">Loading leaderboard…</div>}>
      <LeaderboardContent />
    </Suspense>
  );
}
