'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { formatCountdown, formatISTDateTime } from '@/lib/date';
import { formatClassLevel, isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import type { CourseCatalogItem, EventsScreenConfig } from '@/types';
import { visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenEmpty,
  ScreenHelpNote,
  ScreenPageHeader,
  ScreenSection,
  screenGridClass,
} from '@/components/student/ScreenScaffold';
import { pageIdentity } from '@/lib/page-identity';

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
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
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
    origin ? `URL:${origin}/events` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
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

function EventCard({ record, screen }: { record: EventRecord; screen: EventsScreenConfig }) {
  const countdown = useCountdown(record.state === 'upcoming' ? record.start : null);
  return (
    <article className="ec-card flex flex-col overflow-hidden">
      {record.image ? (
        <img src={record.image} alt="" className="h-40 w-full bg-ink-100 object-cover" loading="lazy" />
      ) : (
        <div className="grid h-40 w-full place-items-center bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-bold uppercase tracking-wider text-white/80">
          {record.item.exam}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-snug">{record.item.title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATE_TONE[record.state]}`}>
            {screen.filterLabels[record.state] || record.state}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-ink-500 line-clamp-2">{record.item.description}</p>
        <p className="mt-2 text-[11px] font-semibold text-ink-700">
          {record.start ? formatISTDateTime(record.start) : 'Schedule to be announced'}
          {record.end ? ` → ${formatISTDateTime(record.end)}` : ''}
        </p>
        {countdown && <p className="mt-0.5 text-[10px] font-bold text-brand-700">Starts in {countdown}</p>}
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {record.link &&
            (isValidInternalDeepLink(record.link) ? (
              <Link href={record.link} className="ec-btn bg-[var(--ec-brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--ec-on-brand)]">
                {screen.detailsCtaLabel}
              </Link>
            ) : (
              <a href={record.link} target="_blank" rel="noopener noreferrer" className="ec-btn bg-[var(--ec-brand)] px-3 py-1.5 text-[11px] font-bold text-[var(--ec-on-brand)]">
                {screen.detailsCtaLabel} ↗
              </a>
            ))}
          {record.start && (
            <button type="button" onClick={() => downloadIcs(record)} className="ec-btn border border-ink-200 px-3 py-1.5 text-[11px] font-bold">
              {screen.addToCalendarLabel}
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
  const screen = config.eventsScreen;
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

  const visible = records
    .filter((record) => {
      if (filter !== 'all' && record.state !== filter) return false;
      if (selectedDay && (!record.start || record.start.slice(0, 10) !== selectedDay)) return false;
      return true;
    })
    .slice(0, screen.itemLimit > 0 ? screen.itemLimit : undefined);

  const sections = visibleSectionIds('eventsScreen', screen);
  const gridClass = screenGridClass(screen.layout);
  const filterOptions: Array<'all' | EventState> = ['all', 'live', 'upcoming', 'completed', 'unscheduled'];

  if (initializing) {
    return <div className="mx-auto max-w-6xl ec-skeleton h-64" />;
  }

  function renderCalendar() {
    return (
      <section className="ec-card p-3" aria-label="Event calendar">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setSelectedDay(null); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }}
            className="h-8 w-8 rounded-lg border border-ink-200 text-sm"
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="text-sm font-bold">{month.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p>
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
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendar.map((cell, index) => {
            const isSelected = cell.date && cell.date === selectedDay;
            const hasEvents = cell.events.length > 0;
            return (
              <button
                key={`${cell.date || 'blank'}-${index}`}
                type="button"
                disabled={!cell.date}
                onClick={() => setSelectedDay(cell.date)}
                aria-label={cell.date ? `${cell.date}${hasEvents ? `, ${cell.events.length} events` : ''}` : undefined}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] transition ${
                  !cell.date
                    ? 'opacity-0'
                    : isSelected
                      ? 'bg-[var(--ec-brand)] font-bold text-[var(--ec-on-brand)]'
                      : hasEvents
                        ? 'bg-brand-50 font-bold text-brand-800 hover:bg-brand-100'
                        : 'text-ink-600 hover:bg-ink-50'
                }`}
              >
                {cell.day}
                {hasEvents && !isSelected && <span className="mt-0.5 h-1 w-1 rounded-full bg-[var(--ec-brand)]" />}
              </button>
            );
          })}
        </div>
        {screen.calendarNote ? <p className="mt-2 text-center text-[10px] text-ink-400">{screen.calendarNote}</p> : null}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ScreenPageHeader
        identity={pageIdentity('events')}
        showHeader={screen.showHeader}
        eyebrow={screen.eyebrow}
        title={screen.pageTitle}
        description={screen.pageSubtitle}
        meta={profile ? <span className="ec-chip">{profile.exam} · {formatClassLevel(profile.class_level)}</span> : undefined}
        actions={
          <Link href="/home" className="ec-btn border border-ink-200 px-3.5 py-2 text-xs font-bold">
            ← Dashboard
          </Link>
        }
      />

      <ScreenAnnouncementBanner announcement={screen.announcement} />

      {sections.map((id) => {
        if (id === 'calendar') {
          if (!screen.showCalendar) return null;
          return (
            <ScreenSection key={id}>
              <div className="max-w-md">{renderCalendar()}</div>
            </ScreenSection>
          );
        }
        if (id === 'list') {
          return (
            <ScreenSection key={id}>
              {screen.showFilters ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {filterOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      aria-pressed={filter === option}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                        filter === option ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-[var(--ec-surface)] text-ink-600'
                      }`}
                    >
                      {screen.filterLabels[option]}
                    </button>
                  ))}
                  {(selectedDay || filter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => { setSelectedDay(null); setFilter('all'); }}
                      className="text-[11px] font-semibold text-brand-700"
                    >
                      Clear filters
                    </button>
                  )}
                  <span className="ml-auto text-[11px] text-ink-500">
                    {visible.length} event{visible.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
              {visible.length ? (
                <div className={gridClass}>
                  {visible.map((record) => <EventCard key={record.item.id} record={record} screen={screen} />)}
                </div>
              ) : (
                <ScreenEmpty title={selectedDay ? screen.noResultsTitle : screen.emptyTitle} body={selectedDay ? screen.noResultsBody : screen.emptyBody} />
              )}
            </ScreenSection>
          );
        }
        if (id === 'info') {
          return (
            <ScreenSection key={id} title={screen.infoTitle}>
              <p className="rounded-[var(--ec-radius)] border border-ink-200 bg-[var(--ec-surface)] p-4 text-[11.5px] leading-relaxed text-ink-500">
                {screen.infoBody}
              </p>
            </ScreenSection>
          );
        }
        return null;
      })}

      <ScreenHelpNote help={screen.help} />
    </div>
  );
}
