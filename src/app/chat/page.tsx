'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import type { ChatMessage } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
} from '@/components/student/ScreenScaffold';

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function StudentChatPage() {
  const { user } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.chat;
  const { push } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    import('@/lib/firestore')
      .then(({ subscribeToStudentMessages, markThreadReadForStudent }) => {
        if (cancelled) return;
        unsubscribe = subscribeToStudentMessages(
          user.uid,
          (next) => {
            setMessages(next);
            setLoading(false);
            setError(null);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
        void markThreadReadForStudent(user.uid).catch(() => undefined);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to open your conversation.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 5000) {
      push('Message is too long (maximum 5000 characters).', 'error');
      return;
    }
    setSending(true);
    try {
      const { sendStudentMessage } = await import('@/lib/firestore');
      await sendStudentMessage(user.uid, trimmed, 'student', user.uid);
      setText('');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Message could not be sent.', 'error');
    } finally {
      setSending(false);
    }
  }

  if (!user) {
    return <div className="mx-auto max-w-xl text-sm text-ink-500">Sign in to message your mentor.</div>;
  }

  const sections = visibleSectionIds('chat', screen);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-2xl flex-col space-y-4">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
      />

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {sections.map((id) => {
        if (id === 'thread') {
          return (
            <ScreenSection key={id}>
              <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden">
                <div
                  ref={listRef}
                  className="flex-1 space-y-3 overflow-y-auto bg-ink-50/70 p-4"
                  aria-live="polite"
                  aria-busy={loading}
                >
                  {loading ? (
                    <div className="space-y-2">
                      <div className="ec-skeleton h-12 w-2/3" />
                      <div className="ec-skeleton ml-auto h-12 w-1/2" />
                    </div>
                  ) : messages.length === 0 && !error ? (
                    <div className="py-6">
                      <ScreenEmpty title={screen.emptyTitle} body={screen.emptyBody} />
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderRole === 'student' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            message.senderRole === 'student'
                              ? 'rounded-br-sm bg-brand-600 text-white'
                              : 'rounded-bl-sm border border-ink-200 bg-[var(--ec-surface)]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.text}</p>
                          {screen.showTimestamp ? (
                            <p
                              className={`mt-1 text-[10px] ${
                                message.senderRole === 'student' ? 'text-white/70' : 'text-ink-400'
                              }`}
                            >
                              {formatMessageTime(message.createdAt)}
                              {message.senderRole === 'admin' ? ' · Mentor' : ''}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {error ? (
                  <div role="alert" className="border-t border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
                    {error}
                  </div>
                ) : null}
                <form onSubmit={handleSend} className="flex gap-2 border-t border-ink-100 bg-[var(--ec-surface)] p-3">
                  <label className="flex-1">
                    <span className="sr-only">Your message</span>
                    <input
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder={screen.composerPlaceholder}
                      maxLength={5000}
                      className="ec-field !rounded-full"
                      autoComplete="off"
                    />
                  </label>
                  <Button type="submit" loading={sending} disabled={!text.trim()} aria-label={screen.sendLabel}>
                    <Send size={14} className="mr-1.5" /> {screen.sendLabel}
                  </Button>
                </form>
              </Card>
            </ScreenSection>
          );
        }
        if (id === 'help') {
          return (
            <ScreenSection key={id}>
              <ScreenHelpNote
                help={{ title: screen.helpTitle || screen.help.title, body: screen.helpBody || screen.help.body }}
              />
            </ScreenSection>
          );
        }
        return null;
      })}
    </div>
  );
}
