'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers,
  Sparkles,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react';
import type {
  BatchPage,
  BatchShowcaseConfig,
  CourseCatalogItem,
  MotionPreset,
} from '@/types';
import {
  accentPalette,
  audienceMatchesTarget,
  readBatchLook,
  type BatchLook,
} from '@/lib/studio-config';
import { formatISTDateTime } from '@/lib/date';
import { isSafeHttpUrl, isValidInternalDeepLink } from '@/lib/validation';
import { Reveal } from '@/components/motion/Reveal';

export interface ShowcaseStudent {
  exam?: string | null;
  classLevel?: string | null;
}

export interface PreparedBatch {
  item: CourseCatalogItem;
  look: BatchLook;
  accent: ReturnType<typeof accentPalette>;
  index: number;
}

const CLASS_LABEL: Record<string, string> = { '11': 'Class 11', '12': 'Class 12', Dropper: 'Dropper' };

function classesOf(item: CourseCatalogItem): string[] {
  return Array.isArray(item.classes) && item.classes.length ? item.classes : ['11', '12'];
}

function batchMatchesStudent(item: CourseCatalogItem, student: ShowcaseStudent | null): boolean {
  if (!student) return true;
  const exam = String(student.exam || '');
  const cls = String(student.classLevel || '');
  if (item.exam !== 'Both' && exam && item.exam !== exam) return false;
  if (cls && !classesOf(item).includes(cls)) return false;
  return true;
}

function isLive(item: CourseCatalogItem, look: BatchLook): boolean {
  const end = look.endsAt ? Date.parse(look.endsAt) : null;
  return end === null || Number.isNaN(end) || end > Date.now();
}

export function prepareBatches(
  batches: CourseCatalogItem[],
  config: BatchShowcaseConfig,
  student: ShowcaseStudent | null,
  page: BatchPage = config.pages[0] || 'home'
): PreparedBatch[] {
  // The global page placement is an independent kill switch; a per-batch
  // placement must not bypass the admin's overall Batch Studio page setting.
  if (!config.enabled || !config.pages.includes(page)) return [];

  const prepared = batches
    .map((item, index) => {
      const look = readBatchLook(item.metadata as Record<string, unknown>, index);
      return { item, look, index };
    })
    .filter(({ item, look }) => item.active !== false && isLive(item, look))
    .filter(({ item }) => batchMatchesStudent(item, student))
    .filter(({ look }) => look.pages.length === 0 || look.pages.includes(page))
    .sort((a, b) => b.look.priority - a.look.priority || a.index - b.index)
    .slice(0, config.maxItems);

  return prepared.map(({ item, look }, index) => {
    const accentKey = look.accent === 'auto' ? config.accentCycle[index % config.accentCycle.length] : look.accent;
    return { item, look, accent: accentPalette(accentKey, index), index };
  });
}

function useCountdown(targetIso: string): { label: string; urgent: boolean } | null {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [targetIso]);
  if (!targetIso) return null;
  const target = Date.parse(targetIso);
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  if (diff <= 0) return { label: 'Started', urgent: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return {
    label: days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`,
    urgent: diff < 86400000 * 2,
  };
}

function BatchArtwork({ look, title, className }: { look: BatchLook; title: string; className?: string }) {
  const imageUrl = look.heroImageUrl || look.imageUrl;
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  if (imageUrl) {
    return <img src={imageUrl} alt={title} loading="lazy" className={className} />;
  }
  return (
    <div className={`${className || ''} grid place-items-center`} aria-hidden>
      <span className="text-3xl font-black tracking-tight text-white/90 drop-shadow-sm sm:text-4xl">{initials || 'EC'}</span>
    </div>
  );
}

function RewardChip({ look }: { look: BatchLook }) {
  if (!look.reward.enabled || look.reward.type === 'none') return null;
  return (
    <span className="ec-batch-reward" title="Reward details configured by the academy">
      <span aria-hidden>{look.reward.icon || '🏅'}</span>
      {look.reward.label || 'Completion reward'}
      {look.reward.value ? <strong className="font-black">· {look.reward.value}</strong> : null}
    </span>
  );
}

function FeatureChips({ look }: { look: BatchLook }) {
  if (!look.features.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {look.features.slice(0, 4).map((feature) => (
        <li key={feature.id} className="ec-tint-chip">
          <span aria-hidden>{feature.icon || '✓'}</span>
          {feature.label}
        </li>
      ))}
    </ul>
  );
}

function batchHref(item: CourseCatalogItem, look: BatchLook): string {
  const customHref = look.ctaHref.trim();
  if (customHref && isValidInternalDeepLink(customHref)) return customHref;
  if (customHref && isSafeHttpUrl(customHref)) return customHref;
  return `/lectures/${encodeURIComponent(item.id)}`;
}

export function BatchStudioCard({
  batch,
  config,
  animation = 'fade-up',
}: {
  batch: PreparedBatch;
  config?: BatchShowcaseConfig;
  animation?: MotionPreset;
}) {
  const flags = config || null;
  const { item, look, accent } = batch;
  const countdown = useCountdown(look.startsAt);
  const href = batchHref(item, look);

  return (
    <Reveal motion={animation} className="h-full">
      <article
        className="ec-batch-card ec-card-hover h-full"
        style={{
          ['--accent-from' as string]: accent.from,
          ['--accent-to' as string]: accent.to,
        }}
      >
        <div className="ec-batch-card__glow" aria-hidden />
        <div className="ec-batch-media aspect-[16/9] w-full">
          <BatchArtwork look={look} title={item.title} className="h-full w-full object-cover" />
          <span className="ec-batch-badge">
            {look.badge || (item.exam === 'Both' ? 'JEE + NEET' : item.exam)}
          </span>
          {look.heroImageUrl ? null : (
            <span className="absolute bottom-2 right-2 z-[2] rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              {classesOf(item).map((cls) => CLASS_LABEL[cls] || cls).join(' · ')}
            </span>
          )}
        </div>

        <div className="relative flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="ec-batch-title">{item.title}</h3>
            {countdown && (!flags || flags.showCountdown) && (
              <span className="ec-countdown shrink-0">
                <Clock3 size={11} /> {countdown.label}
              </span>
            )}
          </div>
          {(look.subtitle || item.description) && (
            <p className="mt-1 line-clamp-2 text-[0.82rem] leading-relaxed text-ink-500">
              {look.subtitle || item.description}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {look.instructor && (!flags || flags.showInstructor) && (
              <span className="ec-batch-meta">
                <UserRound size={12} /> {look.instructor}
              </span>
            )}
            {look.startsAt && (
              <span className="ec-batch-meta">
                <CalendarDays size={12} /> {formatISTDateTime(look.startsAt)}
              </span>
            )}
            {look.seats > 0 && (!flags || flags.showSeats) && (
              <span className="ec-seat-pill">
                <Users size={11} /> {look.seats} seats
              </span>
            )}
          </div>

          {(!flags || flags.showFeatures) && (
            <div className="mt-2.5">
              <FeatureChips look={look} />
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            {(!flags || flags.showReward) && <RewardChip look={look} />}
            <Link href={href} className="ec-batch-cta ml-auto">
              {look.ctaLabel || 'Open batch'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

function WideCard({ batch }: { batch: PreparedBatch }) {
  const { item, look, accent } = batch;
  const countdown = useCountdown(look.startsAt);
  return (
    <Reveal motion="fade-up">
      <article
        className="ec-batch-card ec-card-hover grid overflow-hidden md:grid-cols-[280px_1fr]"
        style={{ ['--accent-from' as string]: accent.from, ['--accent-to' as string]: accent.to }}
      >
        <div className="ec-batch-media relative min-h-[170px]">
          <BatchArtwork look={look} title={item.title} className="h-full w-full object-cover" />
          <span className="ec-batch-badge">{look.badge || item.exam}</span>
        </div>
        <div className="flex flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ec-batch-title">{item.title}</h3>
            {countdown && <span className="ec-countdown"><Clock3 size={11} /> {countdown.label}</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-[0.85rem] leading-relaxed text-ink-500">{look.subtitle || item.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {look.instructor && <span className="ec-batch-meta"><UserRound size={12} /> {look.instructor}</span>}
            {look.startsAt && <span className="ec-batch-meta"><CalendarClock size={12} /> {formatISTDateTime(look.startsAt)}</span>}
            {look.seats > 0 && <span className="ec-seat-pill"><Users size={11} /> {look.seats} seats</span>}
          </div>
          <div className="mt-2"><FeatureChips look={look} /></div>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            <RewardChip look={look} />
            <Link href={batchHref(item, look)} className="ec-batch-cta ml-auto">
              {look.ctaLabel || 'Open batch'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

function MinimalCard({ batch }: { batch: PreparedBatch }) {
  const { item, look, accent } = batch;
  return (
    <Reveal motion="slide-left">
      <Link
        href={batchHref(item, look)}
        className="ec-batch-card ec-card-hover ec-tinted-rail block p-4 pl-5"
        style={{ ['--tint' as string]: accent.from, ['--accent-from' as string]: accent.from, ['--accent-to' as string]: accent.to }}
      >
        <div className="flex items-center gap-2">
          <span className="ec-tint-chip">{look.badge || item.exam}</span>
          <span className="ec-batch-meta">{classesOf(item).length} classes</span>
          {look.reward.enabled && <span className="ec-batch-meta">🏅 {look.reward.label || 'Reward'}</span>}
        </div>
        <p className="mt-1.5 ec-batch-title">{item.title}</p>
        <p className="mt-1 line-clamp-2 text-[0.82rem] text-ink-500">{look.subtitle || item.description}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[0.78rem] font-bold" style={{ color: accent.from }}>
          {look.ctaLabel || 'Open batch'} <ArrowRight size={13} />
        </span>
      </Link>
    </Reveal>
  );
}

/**
 * The public Batch Studio showcase. It renders nothing when the admin has not
 * published featured programmes for the requested page, so pages never show an
 * empty shell.
 */
export function BatchShowcase({
  batches,
  config,
  student,
  page,
  compact = false,
}: {
  batches: CourseCatalogItem[];
  config: BatchShowcaseConfig;
  student: ShowcaseStudent | null;
  page: BatchPage;
  compact?: boolean;
}) {
  const prepared = useMemo(
    () => prepareBatches(batches, config, student, page).slice(0, compact ? 3 : config.maxItems),
    [batches, config, student, page, compact]
  );

  if (!config.enabled || prepared.length === 0) return null;
  const layout = compact ? 'tile' : config.layout;

  return (
    <section className="relative">
      <Reveal motion="fade-up">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="ec-eyebrow-pill">
              <Sparkles size={12} /> {config.eyebrow || 'Batch Studio'}
            </span>
            <h2 className="ec-display mt-2.5 max-w-2xl">
              <span className="ec-gradient-text">{config.title}</span>
            </h2>
            {config.subtitle && <p className="ec-lead mt-2 max-w-2xl">{config.subtitle}</p>}
          </div>
          {config.ctaLabel && isValidInternalDeepLink(config.ctaHref) && (
            <Link href={config.ctaHref} className="ec-btn ec-btn-secondary px-4 py-2.5 text-xs font-bold">
              {config.ctaLabel} <ArrowRight size={13} className="ml-1.5" />
            </Link>
          )}
        </div>
      </Reveal>

      {layout === 'wide' ? (
        <div className="space-y-3.5">
          {prepared.map((batch) => (
            <WideCard key={batch.item.id} batch={batch} />
          ))}
        </div>
      ) : layout === 'minimal' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {prepared.map((batch) => (
            <MinimalCard key={batch.item.id} batch={batch} />
          ))}
        </div>
      ) : layout === 'spotlight' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {prepared.map((batch, index) => (
            <div key={batch.item.id} className={index === 0 ? 'lg:col-span-2' : ''}>
              {index === 0 ? <SpotlightCard batch={batch} /> : <BatchStudioCard batch={batch} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {prepared.map((batch) => (
            <BatchStudioCard key={batch.item.id} batch={batch} config={config} />
          ))}
        </div>
      )}
    </section>
  );
}

function SpotlightCard({ batch }: { batch: PreparedBatch }) {
  const { item, look, accent } = batch;
  const countdown = useCountdown(look.startsAt);
  return (
    <Reveal motion="zoom-in">
      <article
        className="ec-batch-card ec-card-hover ec-shine grid overflow-hidden lg:grid-cols-[1.05fr_1fr]"
        style={{ ['--accent-from' as string]: accent.from, ['--accent-to' as string]: accent.to }}
      >
        <div className="ec-batch-media relative min-h-[240px] lg:min-h-[320px]">
          <BatchArtwork look={look} title={item.title} className="h-full w-full object-cover" />
          <span className="ec-batch-badge">{look.badge || 'Flagship programme'}</span>
          <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/65 to-transparent p-4">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/80">Now enrolling</p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {classesOf(item).map((cls) => CLASS_LABEL[cls] || cls).join(' · ')} · {item.exam === 'Both' ? 'JEE & NEET' : item.exam}
            </p>
          </div>
        </div>
        <div className="relative flex flex-col p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {countdown && <span className="ec-countdown"><Clock3 size={12} /> Starts in {countdown.label}</span>}
            {look.seats > 0 && <span className="ec-seat-pill"><Users size={11} /> {look.seats} seats left</span>}
          </div>
          <h3 className="ec-h2 mt-2.5">{item.title}</h3>
          <p className="mt-2 line-clamp-3 text-[0.92rem] leading-relaxed text-ink-500">{look.subtitle || item.description}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {look.instructor && (
              <span className="ec-batch-meta"><UserRound size={13} /> Mentor: <strong className="text-ink-700">{look.instructor}</strong></span>
            )}
            {look.startsAt && (
              <span className="ec-batch-meta"><CalendarDays size={13} /> {formatISTDateTime(look.startsAt)}</span>
            )}
            {item.access_code ? (
              <span className="ec-batch-meta"><Ticket size={13} /> Access code required</span>
            ) : (
              <span className="ec-batch-meta"><CheckCircle2 size={13} /> Instant access</span>
            )}
            <span className="ec-batch-meta"><Layers size={13} /> {item.kind === 'series' ? 'Series' : 'Full batch'}</span>
          </div>

          {look.features.length > 0 && <div className="mt-3"><FeatureChips look={look} /></div>}

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <RewardChip look={look} />
            <Link href={`/lectures/${item.id}`} className="ec-batch-cta ml-auto px-4 py-2.5 text-[0.82rem]">
              {look.ctaLabel || 'Explore this batch'} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
