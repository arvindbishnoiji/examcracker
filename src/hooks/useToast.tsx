'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: string; message: string; type: ToastType; }

const ToastContext = createContext<{ push: (msg:string, type?:ToastType)=>void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, type: ToastType='info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(()=> setToasts(t=> t.filter(x=> x.id!==id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[90vw]">
        {toasts.map(t=> (
          <div key={t.id} className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${t.type==='success'?'bg-emerald-50 border-emerald-200 text-emerald-800': t.type==='error'?'bg-red-50 border-red-200 text-red-800':'bg-white border-ink-200 text-ink-700'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast(){
  const ctx = useContext(ToastContext);
  if(!ctx) throw new Error('useToast outside provider');
  return ctx;
}
