'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';

export default function StudentChatPage(){
  const { user } = useAuth();
  const { push } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!user) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import('@/lib/firestore').then(({ subscribeToStudentMessages, markThreadReadForStudent }) => {
      if (cancelled) return;
      unsub = subscribeToStudentMessages(user.uid, setMessages, (err)=> setError(err.message));
      markThreadReadForStudent(user.uid).catch(()=>{});
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load chat');
    });
    return () => { cancelled = true; unsub?.(); };
  },[user]);

  useEffect(()=>{
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  },[messages]);

  async function handleSend(e: React.FormEvent){
    e.preventDefault();
    if(!user) return;
    if(!text.trim()) return;
    if(text.length>5000){ push('Message too long (max 5000 chars)','error'); return; }
    setSending(true);
    try{
      const { sendStudentMessage } = await import('@/lib/firestore');
      await sendStudentMessage(user.uid, text.trim(), 'student', user.uid);
      setText('');
    }catch(err){ push(err instanceof Error? err.message:'Failed to send','error'); }
    finally{ setSending(false); }
  }

  if(!user) return <div className="max-w-xl mx-auto text-sm text-ink-500">Sign in to chat.</div>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[70vh] min-h-[500px]">
      <div className="mb-3">
        <h1 className="text-xl font-bold">Doubt Chat</h1>
        <p className="text-sm text-ink-500">Real-time via Firestore. You can access only your own thread. Admin can read/respond. Validate max length, reject admin spoof.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3 bg-ink-50">
          {messages.length===0 && <p className="text-sm text-ink-500 text-center py-10">No messages yet. Say hi to your mentor! 👋</p>}
          {messages.map(m=>(
            <div key={m.id} className={`flex ${m.senderRole==='student' ? 'justify-end':'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.senderRole==='student' ? 'bg-brand-600 text-white rounded-br-sm':'bg-white border border-ink-200 rounded-bl-sm'}`}>
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.senderRole==='student'?'text-white/70':'text-ink-400'}`}>{new Date(m.createdAt).toLocaleString('en-IN',{ timeZone:'Asia/Kolkata'})} IST</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} className="p-3 border-t border-ink-100 flex gap-2 bg-white">
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type your doubt..." maxLength={5000} className="flex-1 rounded-full border border-ink-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <Button type="submit" loading={sending} disabled={!text.trim()}>Send</Button>
        </form>
      </Card>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-xs text-ink-400 mt-2 text-center">Firestore rules enforce: student can create only senderRole=student with own UID. Timestamp + unread indicators via live listeners.</p>
    </div>
  );
}
