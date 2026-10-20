'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getStudentAnalysis, getStudentTests } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatWatchDuration } from '@/lib/date';
import type { AnalysisResponse } from '@/types';

export default function ProfileAnalysisPage(){
  const { profile, user, signOut } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisResponse|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      const data = await getStudentAnalysis();
      setAnalysis(data);
    }catch(e){ setError(e instanceof Error? e.message : 'Failed to load analysis'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  if(!profile) return <div className="max-w-xl mx-auto text-sm text-ink-500">No profile. Complete onboarding first.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card className="p-6 flex flex-col sm:flex-row gap-4 items-start">
        <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&background=random`} alt={profile.display_name} className="h-16 w-16 rounded-2xl object-cover bg-ink-100" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-ink-500">{profile.email || user?.email} • {profile.exam} • Class {profile.class_level}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge>{profile.exam}</Badge><Badge>Class {profile.class_level}</Badge>
            <Badge variant="info">UID {profile.firebase_uid.slice(0,8)}</Badge>
            {analysis && <Badge variant="success">Level: {analysis.level}</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/chat" className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold text-center">Open chat</Link>
          <Button variant="outline" onClick={signOut}>Logout</Button>
        </div>
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}
      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-xl">{error} <Button size="sm" variant="outline" className="ml-2" onClick={load}>Retry</Button></div>}

      {analysis && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 text-center"><p className="text-2xl font-bold">{analysis.testsTaken}</p><p className="text-xs text-ink-500">Tests taken</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold">{Math.round(analysis.averagePercentage)}%</p><p className="text-xs text-ink-500">Avg percentage</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold">{analysis.completedLessons}</p><p className="text-xs text-ink-500">Lessons completed</p></Card>
            <Card className="p-4 text-center"><p className="text-2xl font-bold">{formatWatchDuration(analysis.watchedSeconds)}</p><p className="text-xs text-ink-500">Watch time</p></Card>
          </div>

          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="font-semibold text-sm text-amber-900">Learning level: {analysis.level}</p>
            <p className="text-xs text-amber-800 mt-1">Educational progress indicator based on saved activity (tests + watch time), not an official JEE/NEET rank. Calculated server-side via GET /analysis.</p>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold">Recent attempts</h3>
              {analysis.attempts.length ? (
                <div className="space-y-2 mt-3">
                  {analysis.attempts.slice(0,5).map(a=>(
                    <div key={a.id} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
                      <div>
                        <p className="font-semibold text-sm">{a.test_id.slice(0,8)}</p>
                        <p className="text-xs text-ink-500">{new Date(a.submitted_at).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'})} IST</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{a.score}/{a.max_score}</p>
                        <p className="text-xs text-ink-500">{a.correct_count}✓ {a.incorrect_count}✗ {a.unanswered_count}—</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-ink-500 mt-2">No attempts yet. Take a test to see analysis.</p>}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold">Lesson progress</h3>
              {analysis.lessonProgress.length ? (
                <div className="space-y-2 mt-3">
                  {analysis.lessonProgress.slice(0,5).map(p=>(
                    <div key={p.id || p.lecture_id} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
                      <p className="font-medium text-sm truncate">{p.lecture_id.slice(0,8)}</p>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatWatchDuration(p.watched_seconds)}</p>
                        <p className="text-xs">{p.completed ? 'Completed ✓':'In progress'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-ink-500 mt-2">No lesson progress yet. Watch lectures to track.</p>}
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold">Score summary</h3>
            <p className="text-sm text-ink-500 mt-1">Total {analysis.totalScore}/{analysis.totalMaxScore} across all tests • {analysis.testsTaken} tests • Never calculated from static demo data.</p>
            <div className="mt-3 h-3 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600" style={{ width: `${analysis.totalMaxScore? (analysis.totalScore/analysis.totalMaxScore*100):0}%` }} />
            </div>
          </Card>
        </>
      )}

      <Card className="p-4 bg-white border-ink-100">
        <h3 className="font-semibold text-sm">Quick links</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          <Link href="/home" className="px-3 py-2 bg-ink-900 text-white rounded-xl text-sm">Home</Link>
          <Link href="/tests" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm">Tests</Link>
          <Link href="/lectures" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm">Lectures</Link>
          <Link href="/chat" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm">Chat</Link>
        </div>
      </Card>
    </div>
  );
}
