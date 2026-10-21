'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import type { AppNotification } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
} from '@/components/student/ScreenScaffold';

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { config } = useSiteConfig();
  const screen = config.notifications;
  const { push } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    import('@/lib/firestore')
      .then(({ subscribeToNotifications }) => {
        if (cancelled) return;
        unsubscribe = subscribeToNotifications(
          user.uid,
          (next) => {
            setItems(next);
            setLoading(false);
            setError(null);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load your inbox.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user, reloadKey]);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);
  const filtered = unreadOnly ? items.filter((item) => !item.isRead) : items;

  async function markRead(item: AppNotification) {
    if (!user) return;
    setBusyId(item.id);
    try {
      const { markNotificationRead } = await import('@/lib/firestore');
      await markNotificationRead(user.uid, item.id);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not mark this as read.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!user) {
    return <div className="mx-auto max-w-xl text-sm text-ink-500">Sign in to view your notifications.</div>;
  }

  const sections = visibleSectionIds('notifications', screen);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ScreenPageHeader
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
        meta={
          unreadCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700">
              <Bell size={11} /> {unreadCount} {screen.unreadLabel.toLowerCase()}
            </span>
          ) : null
        }
      />

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {sections.map((id) => {
        if (id === 'list') {
          return (
            <ScreenSection key={id}>
              {screen.showUnreadOnlyToggle ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-200 bg-[var(--ec-surface)] px-3 py-1.5 text-[11px] font-semibold text-ink-700">
                    <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
                    {screen.unreadOnlyLabel}
                  </label>
                  <span className="text-[11px] text-ink-500">
                    {filtered.length} message{filtered.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((index) => <div key={index} className="ec-skeleton h-20 w-full" />)}
                </div>
              ) : error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2"
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      setReloadKey((key) => key + 1);
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <ScreenEmpty
                  icon={<Bell size={18} />}
                  title={unreadOnly ? screen.showUnreadOnlyEmptyTitle : screen.emptyTitle}
                  body={unreadOnly ? screen.showUnreadOnlyEmptyBody : screen.emptyBody}
                  action={
                    unreadOnly ? (
                      <Button size="sm" variant="outline" onClick={() => setUnreadOnly(false)}>
                        Show all notifications
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-2">
                  {filtered.map((item) => (
                    <Card
                      key={item.id}
                      className={`p-4 ${item.isRead ? '' : 'border-brand-100 bg-brand-50/70'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-600">{item.body}</p>
                          <p className="mt-1.5 text-[10.5px] text-ink-400">{formatTime(item.createdAt)} IST</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.isRead ? 'bg-ink-100 text-ink-600' : 'bg-brand-100 text-brand-700'
                            }`}
                          >
                            {item.isRead ? screen.readLabel : screen.unreadLabel}
                          </span>
                          {item.deepLink ? (
                            <Link
                              href={item.deepLink}
                              className="rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white"
                            >
                              {screen.openLabel} →
                            </Link>
                          ) : null}
                          {!item.isRead ? (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === item.id}
                              onClick={() => void markRead(item)}
                            >
                              <Check size={12} className="mr-1" /> {screen.markReadLabel}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScreenSection>
          );
        }
        if (id === 'info') {
          return (
            <ScreenSection key={id}>
              <ScreenHelpNote help={screen.help} />
            </ScreenSection>
          );
        }
        return null;
      })}
    </div>
  );
}
