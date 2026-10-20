'use client';

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type {
  AppNotification,
  BroadcastNotice,
  ChatMessage,
  ClassLevel,
  ExamTrack,
  StudentThread,
} from '@/types';

export function subscribeToStudentMessages(
  studentUid: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const messagesRef = collection(db, 'studentThreads', studentUid, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(250));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          senderUid: String(data.senderUid || ''),
          senderRole: data.senderRole === 'admin' ? 'admin' : 'student',
          text: String(data.text || ''),
          createdAt: String(data.createdAt || new Date().toISOString()),
          readAt: data.readAt ? String(data.readAt) : null,
          isRead: Boolean(data.isRead || data.readAt),
          attachments: Array.isArray(data.attachments) ? (data.attachments as unknown[]).map(String) : [],
        };
      });
      onMessages(list);
    },
    (err) => onError?.(err as Error)
  );
}

export function subscribeToAllStudentThreads(
  onThreads: (threads: StudentThread[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const threadsRef = collection(db, 'studentThreads');
  const q = query(threadsRef, limit(500));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: StudentThread[] = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            studentUid: String((data.studentUid as string) || d.id),
            studentName: data.studentName ? String(data.studentName) : undefined,
            studentEmail: data.studentEmail ? String(data.studentEmail) : null,
            exam: (data.exam as ExamTrack) || undefined,
            classLevel: (data.classLevel as ClassLevel) || undefined,
            lastMessageText: data.lastMessageText ? String(data.lastMessageText) : '',
            lastMessageAt: data.lastMessageAt ? String(data.lastMessageAt) : '',
            lastSenderRole:
              data.lastSenderRole === 'admin'
                ? ('admin' as const)
                : data.lastSenderRole === 'student'
                ? ('student' as const)
                : undefined,
            unreadByAdmin: Boolean(data.unreadByAdmin),
            unreadByStudent: Boolean(data.unreadByStudent),
            updatedAt: data.updatedAt ? String(data.updatedAt) : '',
          };
        })
        .sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return tb - ta;
        });
      onThreads(list);
    },
    (err) => onError?.(err as Error)
  );
}

export async function sendStudentMessage(
  studentUid: string,
  text: string,
  senderRole: 'student' | 'admin' = 'student',
  senderUid: string
): Promise<void> {
  if (!text.trim()) throw new Error('Message cannot be empty');
  if (text.length > 5000) throw new Error('Message is too long (max 5000 characters)');
  if (senderRole === 'admin' && !senderUid) throw new Error('Admin UID required');
  // Prevent student spoofing admin role: this is also enforced by Firestore rules
  if (senderRole === 'admin') {
    // will be validated server-side via rules email check
  }
  const db = getFirestoreDb();
  const threadRef = doc(db, 'studentThreads', studentUid);
  const messagesRef = collection(db, 'studentThreads', studentUid, 'messages');
  const now = new Date().toISOString();

  // Create thread doc if not exists
  await setDoc(
    threadRef,
    {
      studentUid,
      lastMessageText: text.slice(0, 200),
      lastMessageAt: now,
      lastSenderRole: senderRole,
      unreadByAdmin: senderRole === 'student',
      unreadByStudent: senderRole === 'admin',
      updatedAt: now,
    },
    { merge: true }
  );

  await addDoc(messagesRef, {
    senderUid,
    senderRole,
    text: text.trim(),
    createdAt: now,
    readAt: null,
    isRead: false,
  });

  // Update unread flags
  await setDoc(
    threadRef,
    {
      lastMessageText: text.slice(0, 200),
      lastMessageAt: now,
      lastSenderRole: senderRole,
      unreadByAdmin: senderRole === 'student',
      unreadByStudent: senderRole === 'admin',
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function markThreadReadForStudent(studentUid: string): Promise<void> {
  const db = getFirestoreDb();
  const threadRef = doc(db, 'studentThreads', studentUid);
  await updateDoc(threadRef, { unreadByStudent: false }).catch(() => {});
}

export async function markThreadReadForAdmin(studentUid: string): Promise<void> {
  const db = getFirestoreDb();
  const threadRef = doc(db, 'studentThreads', studentUid);
  await updateDoc(threadRef, { unreadByAdmin: false }).catch(() => {});
}

export function subscribeToNotifications(
  studentUid: string,
  onNotifications: (items: AppNotification[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const ref = collection(db, 'users', studentUid, 'notifications');
  const q = query(ref, orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const list: AppNotification[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          title: String(data.title || ''),
          body: String(data.body || data.message || ''),
          deepLink: data.deepLink ? String(data.deepLink) : null,
          createdAt: String(data.createdAt || data.created_at || new Date().toISOString()),
          readAt: data.readAt ? String(data.readAt) : null,
          isRead: Boolean(data.isRead || data.readAt),
          type: (data.type as AppNotification['type']) || 'info',
        };
      });
      onNotifications(list);
    },
    (err) => onError?.(err as Error)
  );
}

export async function markNotificationRead(studentUid: string, notificationId: string): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, 'users', studentUid, 'notifications', notificationId);
  await updateDoc(ref, { isRead: true, readAt: new Date().toISOString() }).catch(() => {});
}

export function subscribeToBroadcasts(
  onBroadcasts: (items: BroadcastNotice[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const ref = collection(db, 'broadcasts');
  const q = query(ref, where('active', '==', true), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const list: BroadcastNotice[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          title: String(data.title || ''),
          body: String(data.body || ''),
          deepLink: data.deepLink ? String(data.deepLink) : null,
          active: Boolean(data.active),
          createdAt: String(data.createdAt || data.created_at || new Date().toISOString()),
        };
      });
      onBroadcasts(list);
    },
    (err) => onError?.(err as Error)
  );
}

// FCM helpers (browser only, optional)
export async function tryRegisterFCMToken(studentUid: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const { APP_CONFIG } = await import('./config');
    if (!APP_CONFIG.firebase.vapidKey) return null;
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: APP_CONFIG.firebase.vapidKey });
    if (!token) return null;
    const db = getFirestoreDb();
    const tokenRef = doc(db, 'fcmTokens', studentUid, 'tokens', token.slice(0, 50));
    await setDoc(tokenRef, { token, createdAt: new Date().toISOString(), platform: 'web' }, { merge: true });
    return token;
  } catch {
    return null;
  }
}
