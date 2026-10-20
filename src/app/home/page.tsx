'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, Badge, Skeleton, EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatISTDateTime, isScheduleActiveNow } from '@/lib/date';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import { getStudentTests, getStudentAnalysis } from '@/lib/api';
import type { CourseCatalogItem, TestCardItem } from '@/types';

function GoalCard({ item }: { item: CourseCatalogItem }) {
  const meta = item.metadata as Record<string, unknown>;
  const startsAt = meta.startsAt as string | null;
  const endsAt = meta.endsAt as string | null;
  const deepLink = meta.deepLink as string;
  const ctaLabel = (meta.ctaLabel as string) || 'Open';
  const displayText = (meta.displayText as string) || item.description;
  const active = isScheduleActiveNow(startsAt, endsAt);
  if (!active) return null;
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-80">📌 Today&apos;s Goal</p>
          <h3 className="mt-1 font-bold leading-tight">{item.title}</h3>
          {displayText && <p className="text-sm opacity-90 mt-1">{displayText}</p>}
          {(startsAt || endsAt) && <p className="text-xs opacity-70 mt-2">{startsAt ? formatISTDateTime(startsAt):''} {endsAt ? `— ${formatISTDateTime(endsAt)}`:''}</p>}
        </div>
        {deepLink && isValidInternalDeepLink(deepLink) && (
          <Link href={deepLink} className="shrink-0 px-3 py-1.5 bg-white text-brand-700 text-xs font-bold rounded-full">{ctaLabel}</Link>
        )}
      </div>
    </div>
  );
}

function EventCarousel({ items }: { items: CourseCatalogItem[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-ink-900">Events & Banners</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map(ev=>{
          const meta = ev.metadata as Record<string, unknown>;
          const images = (meta.images as Array<{url:string; alt?:string; deepLink?:string}>) || [];
          const fallbackThumb = (meta.thumbnailUrl as string) || '';
          const toShow = images.length ? images.slice(0,2) : fallbackThumb ? [{ url: fallbackThumb }] : [];
          return (
            <Card key={ev.id} className="overflow-hidden">
              {toShow.map((img, idx)=>(
                <div key={idx}>
                  {isSafeHttpUrl(img.url) ? (
                    <a href={isValidInternalDeepLink(img.deepLink) ? img.deepLink : undefined} className="block">
                      <img src={img.url} alt={img.alt || ev.title} className="w-full h-40 object-cover" loading="lazy" />
                    </a>
                  ) : null}
                </div>
              ))}
              <CardBody className="p-4">
                <h4 className="font-semibold text-sm">{ev.title}</h4>
                <p className="text-xs text-ink-500 line-clamp-2 mt-1">{ev.description}</p>
                {(meta.deepLink as string) && isValidInternalDeepLink(meta.deepLink as string) && (
                  <Link href={meta.deepLink as string} className="inline-flex mt-2 text-xs font-semibold text-brand-600 hover:underline">{(meta.ctaLabel as string) || 'View →'}</Link>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TestStrip({ title, tests, emptyHint }: { title: string; tests: TestCardItem[]; emptyHint: string }) {
  if (!tests.length) return <EmptyState title={`No ${title.toLowerCase()} tests`} description={emptyHint} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><Link href="/tests" className="text-xs font-semibold text-brand-600">View all →</Link></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tests.slice(0,6).map(t=>(
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm leading-tight line-clamp-2">{t.title}</h4>
              <Badge variant={t.isLive? 'success':'info'}>{t.isLive?'Live':'Scheduled'}</Badge>
            </div>
            <p className="text-xs text-ink-500 mt-1 line-clamp-2">{t.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {t.subject && <Badge>{t.subject}</Badge>}
              <Badge variant="default">{t.durationMinutes ? `${t.durationMinutes} min` : '—'}</Badge>
              <Badge variant="default">{t.totalQuestions} Qs</Badge>
            </div>
            <p className="text-[11px] text-ink-400 mt-2">{t.scheduledAt ? formatISTDateTime(t.scheduledAt) : 'No schedule'} {t.endsAt ? `→ ${formatISTDateTime(t.endsAt)}`:''}</p>
            <Link href={`/tests/${t.id}`} className="mt-3 inline-flex w-full justify-center px-3 py-2 bg-ink-900 text-white text-sm font-semibold rounded-xl">Open test</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function HomePage(){
  const { user, profile, bootstrap, initializing, loading, error, refresh } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<TestCardItem[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);

  useEffect(()=>{
    if(initializing) return;
    if(!user) router.replace('/login');
    else if(!profile) router.replace('/onboarding');
  },[user, profile, initializing, router]);

  const loadTests = useCallback(async()=>{
    if(!profile) return;
    setTestsLoading(true);
    try{
      const t = await getStudentTests();
      setTests(t);
    }catch{} finally{ setTestsLoading(false); }
  },[profile]);

  useEffect(()=>{ loadTests(); },[loadTests]);

  if(initializing || loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid sm:grid-cols-3 gap-4"><Skeleton className="h-32"/><Skeleton className="h-32"/><Skeleton className="h-32"/></div>
      </div>
    );
  }

  if(!profile || !bootstrap){
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 text-center">
          <p className="font-semibold">Unable to load your dashboard</p>
          <p className="text-sm text-ink-500 mt-1">{error || 'Please try again.'}</p>
          <Button onClick={refresh} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  const goals = bootstrap.content.filter(c=>c.kind==='goal');
  const events = bootstrap.content.filter(c=>c.kind==='event');
  const batches = bootstrap.content.filter(c=>c.kind==='batch');
  const series = bootstrap.content.filter(c=>c.kind==='series');
  const lectures = bootstrap.content.filter(c=>c.kind==='lecture');
  const announcements = bootstrap.announcements || [];

  const liveTests = tests.filter(t=> t.isLive);
  const upcomingTests = tests.filter(t=> !t.isLive);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back, {profile.display_name} 👋</h1>
          <p className="text-sm text-ink-500">{profile.exam} • Class {profile.class_level} • {formatISTDateTime(new Date().toISOString())}</p>
        </div>
        <Link href="/profile" className="hidden sm:inline-flex px-4 py-2 bg-white border border-ink-200 rounded-xl text-sm font-semibold">View profile</Link>
      </div>

      {/* Today's Goal — prominent */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎯</span>
          <h2 className="font-bold">Today&apos;s Goal</h2>
          <Badge variant="info">Updated daily by admin</Badge>
        </div>
        {goals.length ? (
          <div className="grid gap-3">
            {goals.slice(0,3).map(g=> <GoalCard key={g.id} item={g} />)}
          </div>
        ) : (
          <Card className="p-4 border-dashed bg-ink-50"><p className="text-sm text-ink-500">No goals yet. The admin can add goals from Dashboard → Today&apos;s Goals.</p></Card>
        )}
      </div>

      {/* Event/Banner carousel */}
      <EventCarousel items={events} />

      {/* Live & Upcoming tests */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          {testsLoading ? <Skeleton className="h-40 w-full" /> : <TestStrip title="Live Tests" tests={liveTests} emptyHint="Live tests appear when admin marks a test as live and schedules it for now (IST)." />}
        </div>
        <div>
          {testsLoading ? <Skeleton className="h-40 w-full" /> : <TestStrip title="Upcoming Tests" tests={upcomingTests} emptyHint="Upcoming tests show here with start time, duration and question count." />}
        </div>
      </div>

      {/* Enrolled / Continue learning */}
      <div className="space-y-3">
        <h3 className="font-semibold">Continue learning</h3>
        {lectures.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lectures.slice(0,6).map(l=>{
              const meta = l.metadata as Record<string,string>;
              const thumb = meta.thumbnailUrl || `https://img.youtube.com/vi/${meta.videoId}/hqdefault.jpg`;
              return (
                <Link key={l.id} href={`/lectures/${l.id}`} className="block">
                  <Card className="overflow-hidden hover:shadow-md transition">
                    <img src={thumb} alt={l.title} className="w-full h-36 object-cover bg-ink-100" loading="lazy" />
                    <div className="p-3">
                      <p className="text-sm font-semibold line-clamp-2 leading-tight">{l.title}</p>
                      <p className="text-xs text-ink-500 line-clamp-1 mt-1">{meta.lesson || meta.topic || l.description}</p>
                      <div className="flex gap-1.5 mt-2"><Badge>{l.exam}</Badge><Badge variant="default">Class {l.classes.join('/')}</Badge>{meta.isPreview && <Badge variant="success">Preview</Badge>}</div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No lectures yet" description="The admin can add lectures from Dashboard → Lectures. Once added, your enrolled batches’ lectures appear here." action={<Link href="/lectures" className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold inline-flex">Browse lectures</Link>} />
        )}
      </div>

      {/* Batches & Series */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Batches</h3><Link href="/lectures" className="text-xs font-semibold text-brand-600">View all →</Link></div>
          {batches.length ? (
            <div className="space-y-2">
              {batches.slice(0,4).map(b=>{
                const meta = b.metadata as Record<string,string>;
                return (
                  <Card key={b.id} className="p-4 flex gap-3">
                    <img src={meta.thumbnailUrl || 'https://via.placeholder.co/80x80?text=Batch'} alt={b.title} className="h-16 w-16 rounded-xl object-cover bg-ink-100 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm line-clamp-1">{b.title}</p>
                      <p className="text-xs text-ink-500 line-clamp-2">{b.description}</p>
                      <div className="flex gap-1 mt-1"><Badge>{b.exam}</Badge><Badge>{b.classes.join(',')}</Badge></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : <EmptyState title="No batches" description="Batches will appear when admin creates them (JEE/NEET + class filtered)." />}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Series</h3><Link href="/lectures" className="text-xs font-semibold text-brand-600">View all →</Link></div>
          {series.length ? (
            <div className="space-y-2">
              {series.slice(0,4).map(s=>{
                const meta = s.metadata as Record<string,string>;
                return (
                  <Card key={s.id} className="p-4 flex gap-3">
                    <img src={meta.thumbnailUrl || 'https://via.placeholder.co/80x80?text=Series'} alt={s.title} className="h-16 w-16 rounded-xl object-cover bg-ink-100 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm line-clamp-1">{s.title}</p>
                      <p className="text-xs text-ink-500 line-clamp-2">{s.description}</p>
                      <div className="flex gap-1 mt-1"><Badge>{s.exam}</Badge><Badge>{s.classes.join(',')}</Badge></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : <EmptyState title="No series" description="Series are curated lecture collections linked to a batch or standalone." />}
        </div>
      </div>

      {/* Announcements */}
      <div className="space-y-3">
        <h3 className="font-semibold">Announcements</h3>
        {announcements.length ? (
          <div className="space-y-2">
            {announcements.map(a=>(
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-sm text-ink-600 mt-1">{a.body}</p>
                    <p className="text-xs text-ink-400 mt-2">{formatISTDateTime(a.scheduled_at)} • Audience: {a.audience}</p>
                  </div>
                  <Badge variant="info">{a.audience}</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4 bg-ink-50 border-dashed"><p className="text-sm text-ink-500">No announcements. Admins can post via Dashboard → Announcements (audience All/JEE/NEET).</p></Card>
        )}
      </div>

      {/* Enrollments */}
      {bootstrap.enrollments && bootstrap.enrollments.length>0 && (
        <Card className="p-4 bg-emerald-50 border-emerald-100">
          <p className="text-sm font-semibold text-emerald-900">Your enrollments</p>
          <p className="text-xs text-emerald-700 mt-1">{bootstrap.enrollments.length} active: {bootstrap.enrollments.map(e=>`${e.item_type}:${e.item_id.slice(0,8)}`).join(', ')}</p>
        </Card>
      )}
    </div>
  );
}
