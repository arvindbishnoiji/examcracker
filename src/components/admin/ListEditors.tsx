'use client';

import type { LinkItem } from '@/types';
import { makeId } from '@/lib/site-config';
import { Field } from './ui';

export function StringListEditor({
  label,
  help,
  items,
  onChange,
  placeholder,
  max = 8,
  addLabel = 'Add item',
}: {
  label: string;
  help?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  addLabel?: string;
}) {
  return (
    <Field label={label} help={help}>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              className="ec-field"
              value={item}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="shrink-0 h-9 w-9 rounded-lg border border-ink-200 text-ink-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length < max && (
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            + {addLabel}
          </button>
        )}
      </div>
    </Field>
  );
}

export function LinkListEditor({
  label,
  help,
  links,
  onChange,
  max = 6,
}: {
  label: string;
  help?: string;
  links: LinkItem[];
  onChange: (next: LinkItem[]) => void;
  max?: number;
}) {
  return (
    <Field label={label} help={help}>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={link.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
            <input
              className="ec-field"
              value={link.label}
              placeholder="Label"
              onChange={(event) => {
                const next = [...links];
                next[index] = { ...link, label: event.target.value };
                onChange(next);
              }}
            />
            <input
              className="ec-field"
              value={link.href}
              placeholder="/route or https://…"
              onChange={(event) => {
                const next = [...links];
                next[index] = { ...link, href: event.target.value, external: /^https?:\/\//i.test(event.target.value) };
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(links.filter((item) => item.id !== link.id))}
              className="h-9 w-9 rounded-lg border border-ink-200 text-ink-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove link"
            >
              ✕
            </button>
          </div>
        ))}
        {links.length < max && (
          <button
            type="button"
            onClick={() => onChange([...links, { id: makeId('link'), label: '', href: '' }])}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            + Add link
          </button>
        )}
      </div>
    </Field>
  );
}

export function MultiPills<T extends string>({
  label,
  help,
  options,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <Field label={label} help={help}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(active ? value.filter((item) => item !== option.value) : [...value, option.value])}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-ink-200 bg-[var(--ec-surface)] text-ink-600 hover:bg-ink-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}
