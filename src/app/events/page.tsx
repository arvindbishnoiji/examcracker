'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { formatCountdown, formatISTDateTime } from '@/lib/date';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import type { CourseCatalogItem } from '@/types';

type EventState = 'live' | 'upcoming' | 'completed' | 'unscheduled';

interface EventRecord {
  item: CourseCatalogItem;
  start: string | null;
  end: string | null;
  state: EventState;
  link: string;
  image: string;
}

function metaOf(item: CourseCatalogItem): Record<string, unknown> {
  return (item.metadata || {}) as Record<string, unknown>;
}

function buildRecords(items: CourseCatalogItem[]): EventRecord[] {
  const now = Date.now();
  return items
    .filter((item) => item.kind === 'event')
    .map((item) => {
      const meta = metaOf(item);
      const start = typeof meta.startsAt === 'string' ? meta.startsAt : null;
      const end = typeof meta.endsAt === 'string' ? meta.endsAt : null;
      const startMs = start ? Date.parse(start) : null;
      const endMs = end ? Date.parse(end) : null;
      let state: EventState = 'unscheduled';
      if (startMs) {
        if (startMs > now) state = 'upcoming';
        else if (!endMs || endMs > now) state = 'live';
        else state = 'completed';
      }
      const images = Array.isArray(meta.images) ? (meta.images as Array<{ url?: string }>) : [];
      const image =
        images.find((imageItem) => imageItem?.url && isSafeHttpUrl(imageItem.url))?.url ||
        (typeof meta.thumbnailUrl === 'string' && isSafeHttpUrl(meta.thumbnailUrl) ? meta.thumbnailUrl : '');
      const link =
        typeof meta.deepLink === 'string' && (isValidInternalDeepLink(meta.deepLink) || isSafeHttpUrl(meta.deepLink))
          ? meta.deepLink
          : '';
      return { item, start, end, state, link, image };
    })
    .sort((a, b) => {
      const aTime = a.start ? Date.parse(a.start) : Number.MAX_SAFE_INTEGER;
      const bTime = b.start ? Date.parse(b.start) : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

const STATE_TONE: Record<EventState, string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  upcoming: 'bg-sky-50 text-sky-700 border-sky-200',
  completed: 'bg-ink-100 text-ink-500 border-ink-200',
  unscheduled: 'bg-amber-50 text-amber-800 border-amber-200',
};

function icsDate(value: string): string {
  return `${new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function downloadIcs(record: EventRecord) {
  if (!record.start) return;
  const start = new Date(record.start);
  const end = record.end ? new Date(record.end) : new Date(start.getTime() + 60 * 60 * 1000);
  const escape = (value: string) => value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Exam Cracker//Events//EN',
    'BEGIN:VEVENT',
    `UID:${record.item.id}@exam-cracker`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start.toISOString())}`,
    `DTEND:${icsDate(end.toISOString())}`,
    `SUMMARY:${escape(record.item.title)}`,
    `DESCRIPTION:${escape(record.item.description || 'Exam Cracker event')}`,
    'URL:https://exam-cracker-web.arvinddara0290.workers.dev/events',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function useCountdown(target: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  if (!target) return null;
  const remaining = (Date.parse(target) - now) / 1000;
  if (Number.isNaN(remaining) || remaining <= 0) return null;
  return formatCountdown(remaining);
}

function EventCard({ record }: { record: EventRecord }) {
  const countdown = useCountdown(record.state === 'upcoming' ? record.start : null);
  return (
    <article className="ec-card overflow-hidden flex flex-col">
      {record.image ? (
        <img src={record.image} alt="" className="h-40 w-full object-cover bg-ink-100" loading="lazy" />
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-brand-500 to-brand-800 grid place-items-center text-white/80 text-xs font-bold uppercase tracking-wider">
          {record.item.exam}
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-snug">{record.item.title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATE_TONE[record.state]}`}>
            {record.state}
          </span>
        </div>
        <p className="text-[11px] text-ink-500 mt-1 line-clamp-2">{record.item.description}</p>
        <p className="text-[11px] font-semibold text-ink-700 mt-2">
          {record.start ? formatISTDateTime(record.start) : 'Schedule to be announced'}
          {record.end ? ` → ${formatISTDateTime(record.end)}` : ''}
        </p>
        {countdown && <p className="text-[10px] text-brand-700 font-bold mt-0.5">Starts in {countdown}</p>}
        <div className="flex flex-wrap gap-2 mt-auto pt-3">
          {record.link && (
            isValidInternalDeepLink(record.link) ? (
              <Link href={record.link} className="ec-btn px-3 py-1.5 text-[11px] font-bold bg-[var(--ec-brand)] text-[var(--ec-on-brand)]">
                Register / details
              </Link>
            ) : (
              <a href={record.link} target="_blank" rel="noopener noreferrer" className="ec-btn px-3 py-1.5 text-[11px] font-bold bg-[var(--ec-brand)] text-[var(--ec-on-brand)]">
                Register ↗
              </a>
            )
          )}
          {record.start && (
            <button type="button" onClick={() => downloadIcs(record)} className="ec-btn px-3 py-1.5 text-[11px] font-bold border border-ink-200">
              Add to calendar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function EventsPage() {
  const { bootstrap, profile, initializing, user } = useAuth();
  const { config } = useSiteConfig();
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | EventState>('all');

  useEffect(() => {
    if (!initializing && !user) router.replace('/login');
  }, [initializing, user, router]);

  const records = useMemo(() => buildRecords(bootstrap?.content || []), [bootstrap]);

  const calendar = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const leading = first.getDay();
    const cells: Array<{ date: string | null; day: number | null; events: EventRecord[] }> = [];
    for (let i = 0; i < leading; i += 1) cells.push({ date: null, day: null, events: [] });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        date: key,
        day,
        events: records.filter((record) => record.start && record.start.slice(0, 10) === key),
      });
    }
    return cells;
  }, [month, records]);

  const visible = records.filter((record) => {
    if (filter !== 'all' && record.state !== filter) return false;
    if (selectedDay && (!record.start || record.start.slice(0, 10) !== selectedDay)) return false;
    return true;
  });

  if (initializing) {
    return <div className="max-w-6xl mx-auto ec-skeleton h-64" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Events &amp; Calendar</h1>
          <p className="text-sm text-ink-500 mt-1">
            Mock tests, marathons and doubt sessions{profile ? ` for ${profile.exam} · Class ${profile.class_level}` : ''}. Times are IST.
          </p>
        </div>
        <Link href="/home" className="px-3.5 py-2 text-xs font-bold border border-ink-200 rounded-[var(--ec-button-radius)] bg-white">
          ← Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'live', 'upcoming', 'completed', 'unscheduled'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border capitalize ${
              filter === option ? 'bg-ink-900 text-white border-ink-900' : 'bg-white border-ink-200 text-ink-600'
            }`}
          >
            {option}
          </button>
        ))}
        {(selectedDay || filter !== 'all') && (
          <button type="button" onClick={() => { setSelectedDay(null); setFilter('all'); }} className="text-[11px] font-semibold text-brand-700">
            Clear filters
          </button>
        )}
        <span className="ml-auto text-[11px] text-ink-500">{visible.length} events</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
        <section className="ec-card p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => { setSelectedDay(null); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}
              className="h-8 w-8 rounded-lg border border-ink-200 text-sm"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-bold">
              {month.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => { setSelectedDay(null); setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }}
              className="h-8 w-8 rounded-lg border border-ink-200 text-sm"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase text-ink-400">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1 mt-1">
            {calendar.map((cell, index) => {
              const isSelected = cell.date && cell.date === selectedDay;
              const hasEvents = cell.events.length > 0;
              return (
                <button
                  key={`${cell.date || 'blank'}-${index}`}
                  type="button"
                  disabled={!cell.date}
                  onClick={() => setSelectedDay(cell.date)}
                  className={`aspect-square rounded-lg text-[11px] flex flex-col items-center justify-center transition ${
                    !cell.date
                      ? 'opacity-0'
                      : isSelected
                        ? 'bg-[var(--ec-brand)] text-[var(--ec-on-brand)] font-bold'
                        : hasEvents
                          ? 'bg-brand-50 text-brand-800 font-bold hover:bg-brand-100'
                          : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {cell.day}
                  {hasEvents && !isSelected && <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--ec-brand)]" />}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-ink-400 mt-2 text-center">Days with events are highlighted. Select a day to filter.</p>
        </section>

        <div>
          {visible.length ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {visible.map((record) => <EventCard key={record.item.id} record={record} />)}
            </div>
          ) : (
            <div className="ec-card p-10 text-center">
              <p className="text-sm font-bold">{config.theme.emptyStateTitle || 'No events match this view'}</p>
              <p className="text-xs text-ink-500 mt-1">
                {config.theme.emptyStateBody || 'New events appear here as soon as an admin publishes them.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[var(--ec-radius)] border border-ink-200 bg-white p-4 text-[11px] text-ink-500">
        <p className="font-bold text-ink-700">How reminders work</p>
        <p className="mt-1">
          “Add to calendar” downloads a standard ICS file you can open in Google Calendar, Apple Calendar or Outlook.
          Browser push reminders are not configured, so no in-app reminder is promised.
        </p>
      </div>
    </div>
  );
}
