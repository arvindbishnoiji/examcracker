'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTestForAttempt, submitTestAttempt, getSubmittedTestResult, ApiError } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { formatCountdown } from '@/lib/date';
import type { TestQuestion } from '@/types';

export default function TestAttemptPage(){
  const params = useParams<{id:string}>();
  const id = params.id;
  const router = useRouter();
  const { push } = useToast();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<any>(null);
  const timerRef = useRef<number|null>(null);
  const submitLockRef = useRef(false);
  const submitHandlerRef = useRef<(isAuto?: boolean) => Promise<void>>(async () => {});

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try{
      // Try to fetch for attempt; if already submitted, fallback to result
      try{
        const data = await getTestForAttempt(id);
        setTest(data.test);
        setQuestions(data.questions);
        if(data.test.durationMinutes){
          setTimeLeft(data.test.durationMinutes*60);
        }
        // restore draft from localStorage
        const draftRaw = localStorage.getItem(`ec_test_draft_${id}`);
        if(draftRaw){
          try{ const d = JSON.parse(draftRaw); if(d && typeof d==='object') setAnswers(d); }catch{}
        }
      }catch(e){
        if(e instanceof ApiError && (e.status===409 || e.status===403)){
          // already submitted? try result
          try{
            const res = await getSubmittedTestResult(id);
            setResult(res);
            setShowResult(true);
            setTest({ id, title: 'Test Result', description: '' });
          }catch{
            throw e;
          }
        } else throw e;
      }
    }catch(e){
      setError(e instanceof Error ? e.message : 'Failed to load test');
    } finally{ setLoading(false); }
  },[id]);

  useEffect(()=>{ load(); },[load]);

  // Keep one stable interval while a timed attempt is active.
  const hasTimer = timeLeft !== null;
  useEffect(()=>{
    if(!hasTimer || showResult) return;
    timerRef.current = window.setInterval(()=>{
      setTimeLeft(s=>{
        if(s===null) return null;
        if(s<=1){
          if(timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = null;
          // The lock in handleSubmit prevents duplicate auto/manual submissions.
          void submitHandlerRef.current(true);
          return 0;
        }
        return s-1;
      });
    },1000);
    return ()=>{
      if(timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  },[hasTimer, showResult]);

  // persist draft
  useEffect(()=>{
    if(questions.length) localStorage.setItem(`ec_test_draft_${id}`, JSON.stringify(answers));
  },[answers, id, questions.length]);

  async function handleSubmit(isAuto=false){
    if(!questions.length || submitLockRef.current) return;
    if(!isAuto && !confirm('Submit your answers? You cannot change after submission.')) return;
    submitLockRef.current = true;
    setSubmitting(true);
    let completed = false;
    try{
      const res = await submitTestAttempt(id, answers);
      setResult(res);
      setShowResult(true);
      completed = true;
      localStorage.removeItem(`ec_test_draft_${id}`);
      push('Test submitted — score calculated server-side','success');
      if(timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    }catch(e){
      push(e instanceof Error ? e.message : 'Submit failed','error');
      // Try to show the result if the server accepted a previous submission.
      try{
        const res = await getSubmittedTestResult(id);
        setResult(res);
        setShowResult(true);
        completed = true;
      }catch{}
    } finally{
      if(!completed) submitLockRef.current = false;
      setSubmitting(false);
    }
  }
  submitHandlerRef.current = handleSubmit;

  if(loading) return <div className="max-w-3xl mx-auto space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-60 w-full" /></div>;
  if(error) return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 text-center">
        <p className="font-semibold">{error}</p>
        <p className="text-sm text-ink-500 mt-1">GET /tests/:id is filtered by exam/class and hides answers until submission. Expired or already-attempted tests show result.</p>
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" onClick={()=>router.back()}>Go back</Button>
          <Link href="/tests" className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold">Browse tests</Link>
        </div>
      </Card>
    </div>
  );

  if(showResult && result){
    const { attempt, result: summary, review } = result;
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Card className="p-6 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
          <h1 className="text-xl font-bold">Result • {test?.title || id.slice(0,8)}</h1>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/15 rounded-xl p-3 text-center"><p className="text-2xl font-bold">{summary.score}/{summary.maxScore}</p><p className="text-xs opacity-80">Score</p></div>
            <div className="bg-white/15 rounded-xl p-3 text-center"><p className="text-2xl font-bold">{summary.correct}/{summary.correct+summary.incorrect+summary.unanswered}</p><p className="text-xs opacity-80">Correct</p></div>
            <div className="bg-white/15 rounded-xl p-3 text-center"><p className="text-2xl font-bold">{Math.round(summary.percentage)}%</p><p className="text-xs opacity-80">Accuracy</p></div>
          </div>
          <p className="text-xs opacity-70 mt-3">Correct {summary.correct} • Incorrect {summary.incorrect} • Unanswered {summary.unanswered} • Server-calculated via POST /tests/:id/submit</p>
          <div className="flex gap-2 mt-4">
            <Link href={`/leaderboard?testId=${id}`} className="px-4 py-2 bg-white text-brand-700 rounded-xl text-sm font-semibold">View leaderboard</Link>
            <Link href="/tests" className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-semibold border border-white/30">Back to tests</Link>
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="font-bold">Review & Explanations</h2>
          {review?.length ? review.map((r:any, idx:number)=>(
            <Card key={r.questionId || idx} className={`p-4 border-l-4 ${r.isCorrect ? 'border-l-emerald-500':'border-l-red-500'}`}>
              <p className="font-semibold text-sm">Q{idx+1} • {r.questionId}</p>
              <p className="text-sm mt-1">{r.explanation || 'No explanation provided.'}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant={r.isCorrect?'success':'danger'}>{r.isCorrect ? 'Correct':'Incorrect'} • {r.marksAwarded} marks</Badge>
                <Badge>Your answer: {r.answer || '—'}</Badge>
                <Badge>Correct: {r.correctAnswer || '—'}</Badge>
              </div>
            </Card>
          )) : <Card className="p-4 text-sm text-ink-500">No review items returned by server.</Card>}
        </div>

        <Card className="p-4 bg-ink-50 border-dashed text-xs text-ink-500">
          <p>Attempt ID {attempt.id} • Submitted {new Date(attempt.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST • Never calculate official score solely in browser.</p>
        </Card>
      </div>
    );
  }

  const q = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const total = questions.length;

  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_300px] gap-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{test?.title}</h1>
            <p className="text-sm text-ink-500">{test?.description} • {test?.subject || 'General'} • {test?.durationMinutes ? `${test.durationMinutes} min` : ''} • {total} questions</p>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft!==null && <div className={`px-3 py-2 rounded-xl font-mono font-bold ${timeLeft<300 ? 'bg-red-600 text-white':'bg-ink-900 text-white'}`}>{formatCountdown(timeLeft)}</div>}
            <Link href="/tests" className="px-3 py-2 bg-white border border-ink-200 rounded-xl text-sm">Exit</Link>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="p-4 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
            <p className="font-semibold">Question {currentIdx+1} of {total}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 bg-white border border-ink-200 rounded-full">{answeredCount}/{total} answered</span>
              {q?.marks && <span className="px-2 py-1 bg-brand-50 border border-brand-200 rounded-full text-brand-700">+{q.marks} / -{q.negativeMarks || 0}</span>}
            </div>
          </div>
          <div className="p-6">
            {q ? (
              <div className="space-y-4">
                <p className="text-base font-medium leading-relaxed">{q.text}</p>
                {q.imageUrl && <img src={q.imageUrl} alt="Question" className="max-w-full rounded-xl border border-ink-100" />}
                <div className="space-y-2">
                  {q.options.map(opt=>{
                    const selected = answers[q.id]===opt.id;
                    return (
                      <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${selected ? 'bg-brand-50 border-brand-300':'bg-white border-ink-200 hover:bg-ink-50'}`}>
                        <input type="radio" name={`q-${q.id}`} checked={selected} onChange={()=> setAnswers(a=> ({...a, [q.id]: opt.id}))} className="h-4 w-4" />
                        <span className="font-semibold text-sm w-6">{opt.id}.</span>
                        <span className="text-sm flex-1">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={()=> setAnswers(a=> { const n={...a}; delete n[q.id]; return n;})}>Clear answer</Button>
                  <span className="text-xs text-ink-400 self-center">Draft saved locally (in-progress) and restored on reload.</span>
                </div>
              </div>
            ) : <p className="text-sm text-ink-500">No question data.</p>}
          </div>
          <div className="p-4 bg-white border-t border-ink-100 flex items-center justify-between">
            <Button variant="outline" disabled={currentIdx===0} onClick={()=> setCurrentIdx(i=> Math.max(0,i-1))}>Previous</Button>
            <div className="flex gap-2">
              {currentIdx < total-1 ? (
                <Button onClick={()=> setCurrentIdx(i=> Math.min(total-1,i+1))}>Next</Button>
              ) : (
                <Button onClick={()=> handleSubmit(false)} loading={submitting}>Submit test</Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-amber-50 border-amber-200 text-xs text-amber-900">
          <p>⚠️ Warning: Submitting sends your answers to server for scoring. Server response is authoritative. Duplicate attempts blocked per test unless allowMultipleAttempts enabled by admin.</p>
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Question palette</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((qq, idx)=>{
              const isAnswered = !!answers[qq.id];
              const isCurrent = idx===currentIdx;
              return (
                <button key={qq.id} onClick={()=>setCurrentIdx(idx)} className={`h-9 w-9 rounded-xl text-sm font-semibold border ${isCurrent ? 'bg-brand-600 text-white border-brand-600' : isAnswered ? 'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-white border-ink-200 text-ink-700'}`}>
                  {idx+1}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3 text-[11px]">
            <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-full">Answered</span>
            <span className="px-2 py-1 bg-white border border-ink-200 rounded-full">Not answered</span>
            <span className="px-2 py-1 bg-brand-600 text-white rounded-full">Current</span>
          </div>
          <Button className="w-full mt-4" variant="danger" onClick={()=> handleSubmit(false)} loading={submitting}>Submit • {answeredCount}/{total}</Button>
          <p className="text-[11px] text-ink-400 mt-2 text-center">Handles expired test & duplicate attempts visibly via API errors.</p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold text-sm">Instructions</h4>
          <ul className="text-xs text-ink-500 list-disc pl-4 mt-2 space-y-1">
            <li>Timer uses IST schedule; expired tests show result instead of attempt.</li>
            <li>Answers are sanitized; explanations hidden until after submission.</li>
            <li>LaTeX/math strings preserved verbatim.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
