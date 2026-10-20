import React from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<Variant,string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-ink-900 text-white hover:bg-black',
    outline: 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50',
    ghost: 'text-ink-700 hover:bg-ink-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizes: Record<Size,string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}
