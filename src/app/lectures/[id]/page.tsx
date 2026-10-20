'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCatalogContent, saveLessonProgress, ApiError } from '@/lib/api';
import { Card, CardBody, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { getYoutubeEmbedUrl } from '@/lib/mediaProxy';
import { isSafeHttpUrl } from '@/lib/validation';
import type { CourseCatalogItem } from '@/types';

export default function LecturePlayerPage(){
  const params = useParams<{id:string}>();
  const id = params.id;
  const router = useRouter();
  const { push } = useToast();
  const [lecture, setLecture] = useState<CourseCatalogItem|null>(null);
  const [siblings, setSiblings] = useState<CourseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [watched, setWatched] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPlay, setShowPlay] = useState(true);
  const timerRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async ()=>{
    setLoading(true); setError(null);
    try{
      // Try to find lecture by fetching all lectures then filtering (since /content?kind=lecture without parent may contain it)
      const allLectures = await getCatalogContent({ kind: 'lecture' });
      const found = allLectures.find(l=> l.id===id);
      if(found){
        setLecture(found);
        const meta = found.metadata as Record<string,string>;
        if(meta.parentId){
          try{
            const sibs = await getCatalogContent({ kind:'lecture', parentId: meta.parentId });
            setSiblings(sibs.sort((a,b)=> Number((a.metadata as Record<string,unknown>).position) - Number((b.metadata as Record<string,unknown>).position)));
          }catch{}
        } else {
          setSiblings(allLectures.filter(l=> !((l.metadata as Record<string,unknown>).parentId)));
        }
        return;
      }
      // fallback: try as batch/series parentId search
      const batches = await getCatalogContent({ kind:'batch' });
      const series = await getCatalogContent({ kind:'series' });
      const parent = [...batches, ...series].find(p=> p.id===id);
      if(parent){
        setLecture(parent);
        const sibs = await getCatalogContent({ kind:'lecture', parentId: parent.id }).catch(()=>[] as CourseCatalogItem[]);
        setSiblings(sibs);
        return;
      }
      setError('Lecture not found or not available for your exam/class.');
    }catch(e){
      if(e instanceof ApiError && e.status===403){
        setError(e.message + ' — Enroll in its batch/series first.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load lecture');
      }
    } finally{ setLoading(false); }
  },[id]);

  useEffect(()=>{ load(); },[load]);

  // Watched timer (debounced save)
  useEffect(()=>{
    if(!lecture || lecture.kind!=='lecture') return;
    // start timer when playing
    if(!showPlay){
      timerRef.current = window.setInterval(()=> setWatched(s=> s+1), 1000);
    }
    return ()=> { if(timerRef.current) clearInterval(timerRef.current); };
  },[lecture, showPlay]);

  useEffect(()=>{
    if(watched===0 || !lecture || lecture.kind!=='lecture') return;
    if(debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async ()=>{
      try{
        await saveLessonProgress({ lectureId: lecture.id, watchedSeconds: watched, completed });
      }catch{}
    }, 5000);
    return ()=> { if(debounceRef.current) clearTimeout(debounceRef.current); };
  },[watched, completed, lecture]);

  async function flushProgress(){
    if(!lecture || lecture.kind!=='lecture') return;
    setSaving(true);
    try{
      await saveLessonProgress({ lectureId: lecture.id, watchedSeconds: watched, completed });
      push('Progress saved','success');
    }catch(e){
      push(e instanceof Error ? e.message : 'Failed to save progress','error');
    } finally{ setSaving(false); }
  }

  if(loading) return <div className="max-w-5xl mx-auto space-y-4"><Skeleton className="h-56 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if(error) return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 text-center">
        <p className="font-semibold">{error}</p>
        <p className="text-sm text-ink-500 mt-1">Enroll in the required batch/series or check your exam/class filter. Server enforces access.</p>
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" onClick={()=> router.back()}>Go back</Button>
          <Link href="/lectures" className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold">Browse lectures</Link>
        </div>
      </Card>
    </div>
  );
  if(!lecture) return null;

  const isLecture = lecture.kind==='lecture';
  const meta = lecture.metadata as Record<string, unknown>;
  const videoId = (meta.videoId as string) || '';
  const youtubeUrl = (meta.youtubeUrl as string) || '';
  const notesPdfUrl = meta.notesPdfUrl as string;
  const parentId = meta.parentId as string;

  const currentIdx = siblings.findIndex(s=> s.id===lecture.id);
  const prev = currentIdx>0 ? siblings[currentIdx-1] : null;
  const next = currentIdx>=0 && currentIdx < siblings.length-1 ? siblings[currentIdx+1] : null;

  // If it's a batch/series detail, show its lectures
  if(!isLecture){
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Link href="/lectures" className="text-sm text-brand-600 hover:underline">← Back to lectures</Link>
        <Card className="overflow-hidden">
          {(meta.thumbnailUrl as string) && isSafeHttpUrl(meta.thumbnailUrl as string) && <img src={meta.thumbnailUrl as string} alt={lecture.title} className="w-full h-48 object-cover" />}
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">{lecture.title}</h1>
                <p className="text-sm text-ink-500 mt-1">{lecture.description}</p>
                <div className="flex gap-1 mt-2"><Badge>{lecture.exam}</Badge><Badge>Class {lecture.classes.join('/')}</Badge><Badge variant={lecture.active?'success':'danger'}>{lecture.active?'Active':'Disabled'}</Badge></div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-3">
          <h2 className="font-bold">Lessons in this {lecture.kind} • {siblings.length} items</h2>
          {siblings.length===0 ? <Card className="p-6 text-center text-sm text-ink-500">No lessons yet. Admin can add via Dashboard → Lectures.</Card> :
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {siblings.map(s=>{
                const m = s.metadata as Record<string,string>;
                const thumb = m.thumbnailUrl || `https://img.youtube.com/vi/${m.videoId}/hqdefault.jpg`;
                return (
                  <Link key={s.id} href={`/lectures/${s.id}`} className="block">
                    <Card className="overflow-hidden hover:shadow-md transition">
                      <img src={thumb} alt={s.title} className="w-full h-36 object-cover bg-ink-100" />
                      <div className="p-3">
                        <p className="font-semibold text-sm line-clamp-2">{s.title}</p>
                        <p className="text-xs text-ink-500 line-clamp-1">{m.lesson || m.topic || ''}</p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          }
        </div>
      </div>
    );
  }

  const embedUrl = videoId ? getYoutubeEmbedUrl(videoId) : '';

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link href={parentId ? `/lectures/${parentId}` : '/lectures'} className="text-sm text-brand-600 hover:underline">← Back</Link>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative bg-black aspect-video">
              {embedUrl ? (
                <>
                  <iframe
                    key={videoId}
                    src={embedUrl}
                    title={lecture.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                  {showPlay && (
                    <button onClick={()=> setShowPlay(false)} className="absolute inset-0 grid place-items-center bg-black/40">
                      <span className="px-6 py-3 bg-white text-ink-900 rounded-full font-bold shadow-lg">▶ Play</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full grid place-items-center text-white p-6 text-center">
                  <p>No YouTube video linked. {youtubeUrl ? `URL: ${youtubeUrl}` : 'Add a YouTube URL via admin.'}</p>
                  {youtubeUrl && isSafeHttpUrl(youtubeUrl) && <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 px-4 py-2 bg-white text-black rounded-full text-sm font-semibold">Open on YouTube</a>}
                </div>
              )}
            </div>
            <CardBody>
              <h1 className="text-lg font-bold leading-tight">{lecture.title}</h1>
              <p className="text-sm text-ink-500 mt-1">{lecture.description}</p>
              <div className="flex flex-wrap gap-1 mt-2"><Badge>{lecture.exam}</Badge><Badge>Class {lecture.classes.join('/')}</Badge>{(meta.topic as string) && <Badge>{meta.topic as string}</Badge>}<Badge variant="default">{watched}s watched</Badge>{completed && <Badge variant="success">Completed</Badge>}</div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={()=> setCompleted(c=>!c)}>{completed? 'Mark incomplete':'Mark completed'}</Button>
                <Button size="sm" onClick={flushProgress} loading={saving}>Save progress</Button>
                {notesPdfUrl && isSafeHttpUrl(notesPdfUrl) && <a href={notesPdfUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm font-semibold">View PDF</a>}
                <span className="text-xs text-ink-400 self-center">Progress saved via POST /progress (debounced). Flush on exit.</span>
              </div>

              <div className="flex gap-2 mt-4">
                {prev ? <Link href={`/lectures/${prev.id}`} className="px-4 py-2 bg-ink-900 text-white rounded-xl text-sm font-semibold">← Previous</Link> : <span className="px-4 py-2 bg-ink-100 text-ink-400 rounded-xl text-sm font-semibold">← Previous</span>}
                {next ? <Link href={`/lectures/${next.id}`} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold">Next →</Link> : <span className="px-4 py-2 bg-ink-100 text-ink-400 rounded-xl text-sm font-semibold">Next →</span>}
              </div>

              {notesPdfUrl && isSafeHttpUrl(notesPdfUrl) && (
                <div className="mt-4 border border-ink-200 rounded-xl overflow-hidden">
                  <div className="p-2 bg-ink-50 text-xs font-semibold">PDF Preview</div>
                  <iframe src={notesPdfUrl} title="Notes PDF" className="w-full h-[500px]" />
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="p-3 bg-ink-50 border-dashed text-xs text-ink-500">
            <p>Autoplay may be blocked by browser — click Play to start. Progress persists via Supabase Edge Function; not faked locally.</p>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="font-bold">Up next • {siblings.length} lessons</h2>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
            {siblings.map(s=>{
              const m = s.metadata as Record<string,string>;
              const thumb = m.thumbnailUrl || `https://img.youtube.com/vi/${m.videoId}/hqdefault.jpg`;
              const active = s.id===lecture.id;
              return (
                <Link key={s.id} href={`/lectures/${s.id}`} className={`flex gap-3 p-2 rounded-xl border ${active? 'bg-brand-50 border-brand-200':'bg-white border-ink-100 hover:bg-ink-50'}`}>
                  <img src={thumb} alt={s.title} className="h-16 w-24 rounded-lg object-cover bg-ink-100 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold line-clamp-2 leading-tight">{s.title}</p>
                    <p className="text-xs text-ink-500 line-clamp-1">{m.duration || ''}</p>
                    {active && <Badge variant="info" className="mt-1">Now playing</Badge>}
                  </div>
                </Link>
              );
            })}
            {siblings.length===0 && <p className="text-sm text-ink-500">No sibling lessons found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
