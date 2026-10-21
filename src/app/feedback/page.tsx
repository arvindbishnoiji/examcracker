'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ChevronRight, CircleHelp, Clock3, MessageSquareText, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import {
  addFeedbackMessage,
  getStudentFeedback,
  getStudentFeedbackThread,
  submitFeedback,
  type FeedbackMessageItem,
  type StudentFeedbackItem,
} from '@/lib/api';
import {
  ScreenAnnouncementBanner,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
} from '@/components/student/ScreenScaffold';
import { visibleSectionIds } from '@/lib/screen-config';

function displayTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }) + ' IST';
}
function statusLabel(status?: string) {
  if (status === 'resolved') return 'Resolved';
  if (status === 'in_progress') return 'Response received';
  return 'Open';
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.chat;
  const { push } = useToast();
  const [items, setItems] = useState<StudentFeedbackItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedbackMessageItem[]>([]);
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sections = visibleSectionIds('chat', screen);

  const refresh = useCallback(async () => {
    const next = await getStudentFeedback();
    setItems(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null);
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getStudentFeedback()
      .then((next) => {
        if (cancelled) return;
        setItems(next);
        setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load feedback.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!selectedId || !user) { setMessages([]); return; }
    let cancelled = false;
    setDetailLoading(true);
    getStudentFeedbackThread(selectedId)
      .then((detail) => { if (!cancelled) { setMessages(detail.messages || []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load this feedback.'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, user, items]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (subject.trim().length < 3 || message.trim().length < 3) {
      push('Please add a subject and a little more detail.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await submitFeedback({ subject, category, message });
      setSubject('');
      setMessage('');
      await refresh();
      setSelectedId(created.id);
      push('Feedback submitted successfully.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Feedback could not be submitted.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setReplying(true);
    try {
      await addFeedbackMessage(selectedId, reply);
      setReply('');
      const detail = await getStudentFeedbackThread(selectedId);
      setMessages(detail.messages || []);
      await refresh();
      push('Message added to your feedback.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Message could not be sent.', 'error');
    } finally {
      setReplying(false);
    }
  }

  if (!user) return <div className="mx-auto max-w-xl text-sm text-ink-500">Sign in to send feedback.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle || 'Feedback & help'}
        description={screen.pageSubtitle || 'Share a suggestion, report a problem, or ask us to improve your study experience.'}
      />
      <ScreenAnnouncementBanner announcement={screen.announcement} />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        {sections.includes('thread') && (
          <ScreenSection>
            <Card className="h-full p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <MessageSquareText size={19} />
                </span>
                <div>
                  <h2 className="text-base font-bold">Send feedback</h2>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">Your feedback is private to your account and the Exam Cracker admin.</p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-700">Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="ec-field w-full">
                    <option value="general">General feedback</option>
                    <option value="content">Lectures or study content</option>
                    <option value="tests">Tests and results</option>
                    <option value="technical">Technical issue</option>
                    <option value="suggestion">Feature suggestion</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-700">Subject</span>
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} className="ec-field w-full" maxLength={160} placeholder="What is this feedback about?" required />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink-700">Details</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="ec-field min-h-36 w-full resize-y" maxLength={5000} placeholder="Describe your suggestion or issue…" required />
                  <span className="mt-1 block text-right text-[10px] text-ink-400">{message.length}/5000</span>
                </label>
                <Button type="submit" className="w-full" loading={submitting} disabled={subject.trim().length < 3 || message.trim().length < 3}>
                  <Send size={14} className="mr-2" /> Submit feedback
                </Button>
              </form>
            </Card>
          </ScreenSection>
        )}

        <ScreenSection>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-bold">Your feedback</h2>
                <p className="mt-1 text-xs text-ink-500">Track replies and status updates here.</p>
              </div>
              <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-600">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </div>
            {loading ? (
              <div className="space-y-3 p-4"><div className="ec-skeleton h-16 w-full" /><div className="ec-skeleton h-16 w-full" /></div>
            ) : error && !items.length ? (
              <div className="p-5 text-sm text-red-700" role="alert">{error}<Button className="mt-3" variant="outline" size="sm" onClick={() => { setError(null); setLoading(true); refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }}>Try again</Button></div>
            ) : !items.length ? (
              <div className="px-5 py-12 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink-50 text-ink-400"><CircleHelp size={22} /></span>
                <p className="mt-3 text-sm font-semibold">No feedback submitted yet</p>
                <p className="mt-1 text-xs text-ink-500">Send your first suggestion or report a problem using the form.</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {items.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-ink-50/70 sm:px-5 ${selectedId === item.id ? 'bg-brand-50/60' : ''}`}>
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>
                      {item.status === 'resolved' ? <BadgeCheck size={17} /> : <Clock3 size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink-900">{item.subject}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : item.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{statusLabel(item.status)}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-500">{item.last_message_text || 'No message preview'}</span>
                      <span className="mt-1.5 block text-[10px] text-ink-400">{displayTime(item.updated_at || item.last_message_at)} · {item.category}</span>
                    </span>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-ink-400" />
                  </button>
                ))}
              </div>
            )}
            {selectedId && (
              <div className="border-t border-ink-100">
                <div className="flex items-start justify-between gap-3 bg-ink-50/70 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold">Feedback conversation</p>
                    <p className="mt-0.5 break-all text-[10px] text-ink-400">Reference: {selectedId}</p>
                  </div>
                  <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setSelectedId(null)}>Close</button>
                </div>
                <div className="max-h-[320px] space-y-3 overflow-y-auto p-4 sm:px-5" aria-live="polite" aria-busy={detailLoading}>
                  {detailLoading ? <div className="ec-skeleton h-16 w-full" /> : messages.map((item) => (
                    <div key={item.id} className={`flex ${item.sender_role === 'student' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm ${item.sender_role === 'student' ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm border border-ink-200 bg-[var(--ec-surface)] text-ink-800'}`}>
                        <p className="whitespace-pre-wrap break-words">{item.text}</p>
                        <p className={`mt-1.5 text-[10px] ${item.sender_role === 'student' ? 'text-white/70' : 'text-ink-400'}`}>{item.sender_role === 'admin' ? 'Exam Cracker team · ' : 'You · '}{displayTime(item.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  {!detailLoading && !messages.length && <p className="py-6 text-center text-xs text-ink-400">No messages found for this feedback item.</p>}
                </div>
                {items.find((item) => item.id === selectedId)?.status !== 'resolved' && (
                  <form onSubmit={handleReply} className="flex gap-2 border-t border-ink-100 p-3 sm:p-4">
                    <input value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} placeholder="Add more detail…" className="ec-field min-w-0 flex-1" />
                    <Button type="submit" loading={replying} disabled={!reply.trim()} aria-label="Add message"><Send size={14} /></Button>
                  </form>
                )}
              </div>
            )}
          </Card>
        </ScreenSection>
      </div>
      {sections.includes('help') && (
        <ScreenSection>
          <ScreenHelpNote help={{ title: screen.helpTitle || 'Need a hand?', body: screen.helpBody || 'Share the issue and our team will review your feedback.' }} />
        </ScreenSection>
      )}
    </div>
  );
}
