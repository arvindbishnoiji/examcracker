'use client';

// Compatibility-named module retained for gradual component migration.
// Application records now live in Cloudflare D1 via the same-origin API;
// Firebase is used only to establish the signed-in identity.

type Unsubscribe = () => void;
import { APP_CONFIG } from './config';
import { getFreshIdToken } from './firebase';
import type {
  AppNotification,
  BroadcastNotice,
  ChatMessage,
  ClassLevel,
  ExamTrack,
  StudentThread,
} from '@/types';

async function requestD1<T>(path: string, options: { method?: 'GET'|'POST'|'PATCH'|'DELETE'; body?: unknown } = {}): Promise<T> {
  const token = await getFreshIdToken(false);
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });
  let payload: Record<string, unknown> = {};
  try { payload = await response.json() as Record<string, unknown>; } catch { payload = {}; }
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`);
  return payload as T;
}

function poll<T>(load: () => Promise<T>, onValue: (value: T) => void, onError?: (error: Error) => void, delay = 12000): Unsubscribe {
  let stopped = false;
  let busy = false;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try { const value = await load(); if (!stopped) onValue(value); }
    catch (error) { if (!stopped) onError?.(error instanceof Error ? error : new Error('Unable to load data.')); }
    finally { busy = false; }
  };
  void tick();
  const timer = window.setInterval(() => { void tick(); }, delay);
  return () => { stopped = true; window.clearInterval(timer); };
}

function mapMessage(value: Record<string, unknown>): ChatMessage {
  return {
    id: String(value.id || ''),
    senderUid: String(value.sender_uid || value.senderUid || ''),
    senderRole: value.sender_role === 'admin' || value.senderRole === 'admin' ? 'admin' : 'student',
    text: String(value.text || ''),
    createdAt: String(value.created_at || value.createdAt || new Date().toISOString()),
    readAt: value.read_at ? String(value.read_at) : value.readAt ? String(value.readAt) : null,
    isRead: Boolean(value.is_read || value.isRead || value.read_at || value.readAt),
    attachments: Array.isArray((value.payload as Record<string, unknown> | undefined)?.attachments)
      ? ((value.payload as Record<string, unknown>).attachments as unknown[]).map(String)
      : [],
  };
}
function mapThread(value: Record<string, unknown>): StudentThread {
  return {
    id: String(value.id || ''),
    studentUid: String(value.firebase_uid || value.studentUid || ''),
    studentName: value.display_name ? String(value.display_name) : value.studentName ? String(value.studentName) : undefined,
    studentEmail: value.email ? String(value.email) : value.studentEmail ? String(value.studentEmail) : null,
    exam: (value.exam as ExamTrack) || undefined,
    classLevel: (value.class_level as ClassLevel) || (value.classLevel as ClassLevel) || undefined,
    lastMessageText: String(value.last_message_text || value.lastMessageText || ''),
    lastMessageAt: String(value.last_message_at || value.lastMessageAt || value.updated_at || value.updatedAt || ''),
    lastSenderRole: value.last_sender_role === 'admin' || value.lastSenderRole === 'admin' ? 'admin' : 'student',
    unreadByAdmin: Boolean(value.unread_by_admin || value.unreadByAdmin),
    unreadByStudent: Boolean(value.unread_by_student || value.unreadByStudent),
    updatedAt: String(value.updated_at || value.updatedAt || ''),
  };
}

export function subscribeToStudentMessages(studentUid: string, onMessages: (messages: ChatMessage[]) => void, onError?: (err: Error) => void): Unsubscribe {
  return poll(async () => {
    const list = await requestD1<{ items: Record<string, unknown>[] }>('/feedback');
    const thread = (list.items || []).find((item) => String(item.firebase_uid || item.studentUid || '') === studentUid);
    if (!thread) return [] as ChatMessage[];
    const detail = await requestD1<{ messages: Record<string, unknown>[] }>(`/feedback/${encodeURIComponent(String(thread.id))}`);
    return (detail.messages || []).map(mapMessage);
  }, onMessages, onError);
}

export function subscribeToAllStudentThreads(onThreads: (threads: StudentThread[]) => void, onError?: (err: Error) => void): Unsubscribe {
  return poll(async () => {
    const res = await requestD1<{ items: Record<string, unknown>[] }>('/admin/feedback');
    return (res.items || []).map(mapThread);
  }, onThreads, onError);
}

export function subscribeToFeedbackMessages(threadId: string, onMessages: (messages: ChatMessage[]) => void, onError?: (err: Error) => void): Unsubscribe {
  return poll(async () => {
    const res = await requestD1<{ messages: Record<string, unknown>[] }>(`/admin/feedback/${encodeURIComponent(threadId)}`);
    return (res.messages || []).map(mapMessage);
  }, onMessages, onError);
}

export async function sendStudentMessage(studentUidOrThreadId: string, text: string, senderRole: 'student'|'admin' = 'student', senderUid: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Feedback cannot be empty');
  if (trimmed.length > 5000) throw new Error('Feedback must be 5000 characters or fewer.');
  if (senderRole === 'admin') {
    await requestD1(`/admin/feedback/${encodeURIComponent(studentUidOrThreadId)}/reply`, { method: 'POST', body: { message: trimmed } });
  } else {
    await requestD1('/feedback', { method: 'POST', body: { subject: 'Student feedback', category: 'general', message: trimmed } });
  }
}

export async function markThreadReadForStudent(studentUid: string): Promise<void> {
  const res = await requestD1<{ items: Record<string, unknown>[] }>('/feedback');
  const thread = (res.items || []).find((x) => String(x.firebase_uid || x.studentUid || '') === studentUid);
  if (thread?.id) await requestD1(`/feedback/${encodeURIComponent(String(thread.id))}`);
}
export async function markThreadReadForAdmin(threadId: string): Promise<void> {
  await requestD1(`/admin/feedback/${encodeURIComponent(threadId)}`, { method: 'PATCH', body: { markRead: true } });
}

export function subscribeToNotifications(studentUid: string, onNotifications: (items: AppNotification[]) => void, onError?: (err: Error) => void): Unsubscribe {
  return poll(async () => {
    const res = await requestD1<{ items: Record<string, unknown>[] }>('/notifications');
    return (res.items || []).map((item) => ({
      id: String(item.id || ''),
      title: String(item.title || ''),
      body: String(item.body || ''),
      deepLink: item.deepLink ? String(item.deepLink) : null,
      createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
      readAt: item.readAt ? String(item.readAt) : null,
      isRead: Boolean(item.isRead || item.is_read || item.readAt),
      type: (item.type as AppNotification['type']) || 'info',
    }));
  }, onNotifications, onError);
}

export async function markNotificationRead(studentUid: string, notificationId: string): Promise<void> {
  await requestD1(`/notifications/${encodeURIComponent(notificationId)}`, { method: 'PATCH', body: {} });
}

export function subscribeToBroadcasts(onBroadcasts: (items: BroadcastNotice[]) => void, onError?: (err: Error) => void): Unsubscribe {
  return poll(async () => {
    const res = await requestD1<{ items: Record<string, unknown>[] }>('/broadcasts');
    return (res.items || []).map((item) => ({
      id: String(item.id || ''),
      title: String(item.title || ''),
      body: String(item.body || ''),
      deepLink: item.deepLink ? String(item.deepLink) : null,
      exam: item.exam as BroadcastNotice['exam'],
      classes: Array.isArray(item.classes) ? item.classes.map(String) as ClassLevel[] : undefined,
      active: Boolean(item.active),
      createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
    }));
  }, onBroadcasts, onError);
}

export async function tryRegisterFCMToken(studentUid: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!await isSupported().catch(() => false)) return null;
    if (await Notification.requestPermission() !== 'granted' || !APP_CONFIG.firebase.vapidKey) return null;
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: APP_CONFIG.firebase.vapidKey });
    if (!token) return null;
    await requestD1('/push-tokens', { method: 'POST', body: { token, platform: 'web' } });
    return token;
  } catch { return null; }
}

export interface AdminNotificationInput {
  title: string;
  body: string;
  deepLink?: string | null;
  type?: AppNotification['type'];
}
export async function sendAdminNotification(studentUid: string, input: AdminNotificationInput): Promise<void> {
  await requestD1('/admin/notifications', { method: 'POST', body: { studentUids: [studentUid], input } });
}
export async function sendAdminNotificationBatch(studentUids: string[], input: AdminNotificationInput): Promise<{ sent: number; failed: string[] }> {
  return requestD1('/admin/notifications', { method: 'POST', body: { studentUids, input } });
}
