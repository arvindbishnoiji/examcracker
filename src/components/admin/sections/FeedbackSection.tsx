'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, MessageSquareText, Send } from 'lucide-react';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { getAdminFeedback, getAdminFeedbackThread, replyToFeedback, updateFeedbackStatus, type AdminFeedbackItem, type FeedbackMessageItem } from '@/lib/api';

function timeLabel(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' IST';
}
function statusText(status: string) {
  return status === 'resolved' ? 'Resolved' : status === 'in_progress' ? 'Responded' : 'Open';
}

export function FeedbackSection() {
  const { push } = useToast();
  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FeedbackMessageItem[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getAdminFeedback();
    setItems(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getAdminFeedback();
        if (!active) return;
        setItems(next);
        setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || null);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load feedback.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let active = true;
    setDetailLoading(true);
    getAdminFeedbackThread(selectedId)
      .then((detail) => { if (active) setMessages(detail.messages || []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Unable to open feedback.'); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, items]);

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      await replyToFeedback(selectedId, reply);
      setReply('');
      const detail = await getAdminFeedbackThread(selectedId);
      setMessages(detail.messages || []);
      await refresh();
      push('Feedback response sent.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Reply could not be sent.', 'error');
    } finally { setSending(false); }
  }

  async function setStatus(status: 'open' | 'in_progress' | 'resolved') {
    if (!selectedId) return;
    try {
      await updateFeedbackStatus(selectedId, status);
      await refresh();
      push(status === 'resolved' ? 'Feedback marked resolved.' : 'Feedback status updated.', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Status could not be updated.', 'error');
    }
  }

  const selected = items.find((item) => item.id === selectedId) || null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Student feedback</h2>
          <p className="mt-1 text-sm text-ink-500">Review suggestions and issues submitted from the student app.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="info">{items.length} total</Badge>
          <Badge>{items.filter((item) => item.status !== 'resolved').length} open</Badge>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(270px,0.72fr)_minmax(0,1.28fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-ink-100 bg-ink-50/70 px-4 py-3 font-semibold">Inbox</div>
          {loading ? <div className="space-y-3 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> :
            error && !items.length ? <div role="alert" className="p-4 text-sm text-red-700">{error}<Button size="sm" variant="outline" className="mt-2" onClick={() => { setLoading(true); void refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }}>Retry</Button></div> :
            !items.length ? <EmptyState title="No feedback yet" description="Student submissions will appear here." icon={<MessageSquareText size={20} />} /> :
            <div className="max-h-[68vh] overflow-y-auto divide-y divide-ink-100">
              {items.map((item) => (
                <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full p-4 text-left transition hover:bg-ink-50 ${selectedId === item.id ? 'bg-brand-50/70' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{item.subject || 'Student feedback'}</span>
                    {item.status === 'resolved' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <Clock3 size={16} className="shrink-0 text-amber-600" />}
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-500">{item.display_name || item.email || item.firebase_uid}</p>
                  <p className="mt-1 truncate text-xs text-ink-600">{item.last_message_text || item.category}</p>
                  <p className="mt-2 text-[10px] text-ink-400">{timeLabel(item.updated_at)} · {statusText(item.status)}</p>
                </button>
              ))}
            </div>}
        </Card>

        <Card className="flex min-h-[440px] flex-col overflow-hidden p-0">
          {!selected ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-ink-500">Select a feedback item to review it.</div> : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 bg-ink-50/70 p-4">
                <div className="min-w-0">
                  <h3 className="break-words font-bold">{selected.subject}</h3>
                  <p className="mt-1 text-xs text-ink-500">{selected.display_name || 'Student'} · {selected.email || selected.firebase_uid}</p>
                  <p className="mt-1 text-[11px] text-ink-500">{selected.exam || 'Exam not set'} · Class {selected.class_level || '—'} · {selected.category}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selected.status === 'resolved' ? 'success' : selected.status === 'in_progress' ? 'info' : 'warning'}>{statusText(selected.status)}</Badge>
                  {selected.status !== 'resolved' ? <Button size="sm" variant="outline" onClick={() => void setStatus('resolved')}>Mark resolved</Button> : <Button size="sm" variant="outline" onClick={() => void setStatus('open')}>Reopen</Button>}
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--ec-surface)] p-4" aria-live="polite" aria-busy={detailLoading}>
                {detailLoading ? <Skeleton className="h-20 w-full" /> : messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[86%] rounded-2xl px-3 py-2.5 text-sm ${message.sender_role === 'admin' ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm border border-ink-200 bg-white text-ink-800'}`}>
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      <p className={`mt-1.5 text-[10px] ${message.sender_role === 'admin' ? 'text-white/70' : 'text-ink-400'}`}>{message.sender_role === 'admin' ? 'Admin response' : 'Student'} · {timeLabel(message.created_at)}</p>
                    </div>
                  </div>
                ))}
                {!detailLoading && messages.length === 0 && <p className="py-10 text-center text-sm text-ink-500">No details on this item.</p>}
              </div>
              <form onSubmit={sendReply} className="flex gap-2 border-t border-ink-100 p-3">
                <input className="ec-field min-w-0 flex-1" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a helpful response…" maxLength={5000} />
                <Button type="submit" loading={sending} disabled={!reply.trim()}><Send size={14} className="mr-1.5" /> Reply</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
