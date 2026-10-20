import React from 'react';
export function Card({ className='', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-white border border-ink-100 rounded-2xl shadow-card ${className}`} {...props}>{children}</div>;
}
export function CardHeader({ className='', children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 sm:p-5 border-b border-ink-100 ${className}`}>{children}</div>;
}
export function CardBody({ className='', children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}
export function Badge({ children, variant='default', className='' }: { children: React.ReactNode; variant?: 'default'|'success'|'warning'|'danger'|'info'; className?:string }) {
  const map: Record<string,string> = {
    default: 'bg-ink-100 text-ink-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-brand-100 text-brand-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[variant]} ${className}`}>{children}</span>;
}
export function Skeleton({ className='' }: { className?:string }) {
  return <div className={`animate-pulse bg-ink-100 rounded ${className}`} />;
}
export function EmptyState({ title, description, action }: { title:string; description?:string; action?:React.ReactNode }) {
  return (
    <div className="text-center py-10 px-6 border border-dashed border-ink-200 rounded-2xl bg-ink-50">
      <h3 className="font-semibold text-ink-700">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
