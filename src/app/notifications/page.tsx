'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToNotifications, markNotificationRead } from '@/lib/firestore';
import { Card, Badge, EmptyState } from '@/components/ui/Card';
import Link from 'next/link';

export default function NotificationsPage(){
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(()=>{
    if(!user) return;
    const unsub = subscribeToNotifications(user.uid, setItems);
    return ()=> unsub();
  },[user]);

  if(!user) return <div className="max-w-xl mx-auto text-sm text-ink-500">Sign in to view notifications.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Notifications</h1>
      <p className="text-sm text-ink-500">Live in-app inbox via Firestore, read/unread state, validated deep links. Push requires HTTPS + VAPID key; in-app still works without push.</p>
      {items.length===0 && <EmptyState title="No notifications" description="Notifications from admin appear here (test, lecture, chat, announcement, goal)." />}
      <div className="space-y-2">
        {items.map(n=>(
          <Card key={n.id} className={`p-4 ${n.isRead?'bg-white':'bg-brand-50 border-brand-100'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{n.title}</p>
                <p className="text-sm text-ink-600 mt-1">{n.body}</p>
                <p className="text-xs text-ink-400 mt-2">{new Date(n.createdAt).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'})} IST</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Badge variant={n.isRead?'default':'info'}>{n.isRead?'Read':'Unread'}</Badge>
                {n.deepLink && <Link href={n.deepLink} className="text-xs font-semibold text-brand-600 hover:underline">Open →</Link>}
                {!n.isRead && <button onClick={()=> markNotificationRead(user.uid, n.id)} className="text-xs px-3 py-1 bg-white border border-ink-200 rounded-full">Mark read</button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
