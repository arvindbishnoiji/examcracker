'use client';

import React, { useEffect } from 'react';
import { isHexColor, normalizeHex } from '@/lib/theme';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
};

export function StatusPill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600 mb-1.5">{eyebrow}</p>
        )}
        <h1 className="text-2xl sm:text-[28px] font-extrabold leading-tight text-ink-900">{title}</h1>
        {description && <p className="text-sm text-ink-500 mt-1.5 max-w-3xl leading-relaxed">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 mt-3">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
  icon,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  icon?: React.ReactNode;
}) {
  return (
    <section className={`ec-card ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-ink-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {icon && <span className="text-brand-600 text-sm">{icon}</span>}
              {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            </div>
            {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  trend?: string;
}) {
  return (
    <div className="ec-card p-4 relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</p>
        {icon && (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${TONE_CLASSES[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-extrabold mt-2 tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {hint && <p className="text-[11px] text-ink-500">{hint}</p>}
        {trend && <StatusPill tone="success">{trend}</StatusPill>}
      </div>
    </div>
  );
}

export function Field({
  label,
  help,
  error,
  children,
  required,
  htmlFor,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="w-full">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {help && !error && <p className="mt-1 text-[11px] text-ink-500 leading-relaxed">{help}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-xl border border-ink-100 bg-ink-50/40 px-3.5 py-3 ${
        disabled ? 'opacity-60' : 'cursor-pointer hover:bg-ink-50'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-700">{label}</span>
        {description && <span className="block text-[11px] text-ink-500 mt-0.5 leading-relaxed">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-brand-600' : 'bg-ink-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: {
  options: Array<{ value: T; label: string; icon?: string }>;
  value: T;
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`inline-flex flex-wrap items-center gap-1 rounded-xl border border-ink-200 bg-ink-50/70 p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg font-semibold transition ${
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          } ${
            value === option.value
              ? 'bg-[var(--ec-surface)] text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {option.icon && <span className="mr-1">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  help?: string;
}) {
  const valid = isHexColor(value);
  const normalized = valid ? normalizeHex(value, '#ffffff') : '#ffffff';
  return (
    <Field label={label} help={help} error={!valid ? 'Enter a valid hex colour, e.g. #2563eb.' : undefined}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalized}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} picker`}
          className="h-10 w-11 shrink-0 cursor-pointer rounded-lg border border-ink-200 bg-[var(--ec-surface)] p-1"
        />
        <input
          className="ec-field font-mono text-xs"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#2563eb"
          spellCheck={false}
        />
      </div>
    </Field>
  );
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-3.5 py-3 text-sm flex items-start gap-3 ${TONE_CLASSES[tone]}`}>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={`text-xs leading-relaxed ${title ? 'mt-0.5' : ''} opacity-90`}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-500 py-6 justify-center">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/45 backdrop-blur-sm p-3 sm:p-6">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full ${widths[size]} my-4 sm:my-8 ec-card shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-ink-100">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink-900">{title}</h2>
            {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-lg text-ink-500 hover:bg-ink-100 grid place-items-center"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-ink-100 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="ec-btn px-3 py-2 text-sm font-semibold border border-ink-200 bg-[var(--ec-surface)] text-ink-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`ec-btn px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              tone === 'danger' ? 'bg-red-600' : 'bg-brand-600'
            }`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-500">This action is recorded in the admin activity trail.</p>
    </Modal>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">⌕</span>
      <input
        className="ec-field pl-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (next: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
      <span>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg border border-ink-200 disabled:opacity-40 bg-[var(--ec-surface)]"
        >
          ← Prev
        </button>
        <span className="px-2 font-semibold text-ink-700">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="px-2.5 py-1.5 rounded-lg border border-ink-200 disabled:opacity-40 bg-[var(--ec-surface)]"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 140,
  color = 'var(--ec-brand)',
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1 group">
            <span className="text-[9px] text-ink-500 opacity-0 group-hover:opacity-100 tabular-nums">
              {formatValue ? formatValue(item.value) : item.value}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(2, (item.value / max) * 100)}%`,
                background: color,
                opacity: item.value === 0 ? 0.18 : 1,
              }}
              title={`${item.label}: ${formatValue ? formatValue(item.value) : item.value}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {data.map((item, index) => (
          <span key={`${item.label}-label-${index}`} className="flex-1 text-center text-[8.5px] text-ink-400 truncate">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = 'var(--ec-brand)',
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(percent)}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}
