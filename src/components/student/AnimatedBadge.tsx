'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CheckCircle2,
  Flame,
  Lock,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import type {
  BadgeAnimationPreset,
  BadgeAutoRule,
  BadgeCatalogueEntry,
  BadgeCategory,
  BadgeRarity,
  StudentBadge,
} from '@/types';
import {
  BADGE_AUTO_RULE_OPTIONS,
  buildBadgeSandboxDoc,
  categoryLabel,
  compileScopedBadgeCss,
  describeBadgeCriteria,
  isSandboxHtmlBadgeCode,
  parseBadgeAutoRule,
  rarityMeta,
} from '@/lib/badge-animations';

export interface RenderableBadge {
  id?: string;
  title: string;
  description?: string;
  criteria?: string;
  category?: BadgeCategory;
  rarity?: BadgeRarity;
  image_url?: string;
  animation_preset?: BadgeAnimationPreset;
  animation_code?: string;
  auto_rule?: BadgeAutoRule | string;
}

const SIZE_CLASSES = {
  sm: { box: 'h-12 w-12 rounded-2xl', icon: 22 },
  md: { box: 'h-16 w-16 rounded-2xl', icon: 28 },
  lg: { box: 'h-20 w-20 rounded-[22px]', icon: 34 },
  xl: { box: 'h-28 w-28 rounded-[28px]', icon: 44 },
} as const;

function CategoryGlyph({ category, size }: { category?: BadgeCategory; size: number }) {
  switch (category) {
    case 'verified':
      return <BadgeCheck size={size} className="text-blue-600" aria-hidden />;
    case 'consistency':
      return <Flame size={size} className="text-orange-500" aria-hidden />;
    case 'test_performance':
      return <Trophy size={size} className="text-amber-600" aria-hidden />;
    case 'community':
      return <Star size={size} className="text-violet-600" aria-hidden />;
    default:
      return <Award size={size} aria-hidden />;
  }
}

export function AnimatedBadge({
  badge,
  size = 'md',
  locked = false,
  className = '',
}: {
  badge: RenderableBadge;
  size?: keyof typeof SIZE_CLASSES;
  locked?: boolean;
  className?: string;
}) {
  const reactId = useId();
  const scopeId = useMemo(() => `ecbg${reactId.replace(/[^A-Za-z0-9]/g, '')}`, [reactId]);
  const [imgBroken, setImgBroken] = useState(false);

  const dims = SIZE_CLASSES[size];
  const rarity = rarityMeta(badge.rarity);
  const preset: BadgeAnimationPreset = locked ? 'none' : badge.animation_preset || 'shimmer';
  const rawCode = locked ? '' : (badge.animation_code || '').trim();
  const isHtmlSandbox = Boolean(rawCode && isSandboxHtmlBadgeCode(rawCode));
  const scopedCss = useMemo(
    () => (!rawCode || isHtmlSandbox ? '' : compileScopedBadgeCss(rawCode, scopeId)),
    [rawCode, isHtmlSandbox, scopeId]
  );
  const sandboxDoc = useMemo(
    () => (isHtmlSandbox ? buildBadgeSandboxDoc(rawCode) : ''),
    [isHtmlSandbox, rawCode]
  );

  const imageUrl = (badge.image_url || '').trim();
  const showImage = Boolean(imageUrl) && !imgBroken;

  return (
    <div
      data-badge-scope={scopeId}
      data-badge-preset={preset}
      className={`ec-badge-emblem relative inline-grid place-items-center select-none ${locked ? 'opacity-65 grayscale-[0.55]' : ''} ${className}`}
    >
      {scopedCss ? <style dangerouslySetInnerHTML={{ __html: scopedCss }} /> : null}

      <div className="badge-wrap relative inline-grid place-items-center">
        {sandboxDoc ? (
          <iframe
            title=""
            aria-hidden="true"
            tabIndex={-1}
            sandbox="allow-scripts"
            srcDoc={sandboxDoc}
            className="pointer-events-none absolute -inset-5 z-0 h-[calc(100%+40px)] w-[calc(100%+40px)] border-0 bg-transparent"
          />
        ) : null}

        <div
          className={`badge-ring relative z-10 grid place-items-center overflow-hidden border shadow-sm transition-transform ${dims.box} ${rarity.ringClass}`}
        >
          {showImage ? (
            <img
              src={imageUrl}
              alt={badge.title}
              loading="lazy"
              onError={() => setImgBroken(true)}
              className="badge-img h-full w-full object-contain p-1"
            />
          ) : (
            <span className="badge-img grid place-items-center">
              <CategoryGlyph category={badge.category} size={dims.icon} />
            </span>
          )}
        </div>

        <span className="badge-fx pointer-events-none absolute inset-0 z-20" aria-hidden="true" />

        {locked ? (
          <span
            className="absolute -bottom-1 -right-1 z-30 grid h-6 w-6 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 shadow-sm"
            title="Locked badge — tap to see how to earn"
          >
            <Lock size={11} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Full student badge showcase with Earned + Locked ("Kaise Milega") progress
 * bars and tap-to-inspect modal.
 */
export function BadgeShowcaseSection({
  earnedBadges,
  catalogue = [],
  compact = false,
  title = 'Badges & Achievements',
  subtitle = 'Earn animated honours by completing lectures, acing mock tests, and staying consistent.',
}: {
  earnedBadges: StudentBadge[];
  catalogue?: BadgeCatalogueEntry[];
  compact?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [selected, setSelected] = useState<BadgeCatalogueEntry | null>(null);

  const unified = useMemo<BadgeCatalogueEntry[]>(() => {
    if (catalogue.length > 0) return catalogue;
    return earnedBadges.map((item, idx) => ({
      ...item,
      active: true,
      sort_order: idx,
      earned: true,
      awarded_at: item.awarded_at,
      reason: item.reason,
      currentValue: 1,
      targetValue: 1,
      progressPercent: 100,
    }));
  }, [catalogue, earnedBadges]);

  const earnedCount = useMemo(() => unified.filter((b) => b.earned).length, [unified]);

  const visible = useMemo(() => {
    const list =
      filter === 'earned'
        ? unified.filter((b) => b.earned)
        : filter === 'locked'
          ? unified.filter((b) => !b.earned)
          : [...unified].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progressPercent - a.progressPercent);
    return compact ? list.slice(0, 4) : list;
  }, [unified, filter, compact]);

  const selectedRuleMeta = useMemo(() => {
    if (!selected) return BADGE_AUTO_RULE_OPTIONS[0];
    const parsed = parseBadgeAutoRule(selected.auto_rule);
    return BADGE_AUTO_RULE_OPTIONS.find((o) => o.type === parsed.type) || BADGE_AUTO_RULE_OPTIONS[0];
  }, [selected]);

  return (
    <section className="ec-card p-4 sm:p-5" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold tracking-tight sm:text-lg">{title}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">
              <Sparkles size={11} /> {earnedCount}/{unified.length || earnedCount} Unlocked
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!compact && unified.length > 0 && (
            <div className="inline-flex rounded-xl border border-ink-200 bg-ink-50/70 p-0.5 text-xs">
              {[
                { key: 'all' as const, label: `All (${unified.length})` },
                { key: 'earned' as const, label: `Earned (${earnedCount})` },
                { key: 'locked' as const, label: `How to earn (${Math.max(0, unified.length - earnedCount)})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    filter === tab.key ? 'bg-[var(--ec-surface)] text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {compact && (
            <Link href="/profile#achievements-heading" className="ecc-link text-xs">
              All badges <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((badge) => {
            const rarity = rarityMeta(badge.rarity);
            const howToEarn = describeBadgeCriteria(badge);
            const rule = parseBadgeAutoRule(badge.auto_rule);
            return (
              <button
                key={badge.id}
                type="button"
                onClick={() => setSelected(badge)}
                className={`group flex min-w-0 flex-col items-center rounded-2xl border p-3.5 text-center transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  badge.earned ? rarity.cardClass : 'border-ink-200/80 bg-ink-50/40'
                }`}
              >
                <div className="py-1">
                  <AnimatedBadge badge={badge} size="md" locked={!badge.earned} />
                </div>

                <span
                  className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${rarity.pillClass}`}
                >
                  {badge.earned ? <CheckCircle2 size={10} /> : null}
                  {badge.earned ? `${rarity.label} · Unlocked` : `${rarity.label} · Locked`}
                </span>

                <p className="mt-1.5 w-full truncate text-xs font-extrabold text-ink-900 sm:text-sm">{badge.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-500">{howToEarn}</p>

                {!badge.earned && rule.type !== 'manual' ? (
                  <div className="mt-2.5 w-full">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-ink-500">
                      <span>Progress</span>
                      <span className="tabular-nums text-ink-800">
                        {Math.min(badge.currentValue, badge.targetValue)}/{badge.targetValue}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-200/70">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{ width: `${badge.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : badge.earned && badge.awarded_at ? (
                  <p className="mt-2 text-[10px] font-medium text-emerald-700">
                    Earned{' '}
                    {new Date(badge.awarded_at).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                ) : (
                  <span className="mt-2 text-[10px] font-semibold text-brand-700 group-hover:underline">
                    Tap for Kaise Milega →
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 p-5 text-center">
          <p className="text-sm font-semibold text-ink-700">
            {filter === 'earned' ? 'No badges unlocked yet — start watching lectures or taking tests!' : 'Badges will appear here as soon as your mentors publish them.'}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Every completed lecture and submitted mock test moves you closer to your next honour.
          </p>
        </div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            className="ec-card relative w-full max-w-md overflow-hidden p-5 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close badge details"
              className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
            >
              <X size={15} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="py-2">
                <AnimatedBadge badge={selected} size="xl" locked={false} />
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${rarityMeta(selected.rarity).pillClass}`}>
                  {rarityMeta(selected.rarity).label}
                </span>
                <span className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-[11px] font-semibold text-ink-600">
                  {categoryLabel(selected.category)}
                </span>
              </div>

              <h3 className="mt-2.5 text-xl font-extrabold text-ink-900">{selected.title}</h3>
              {selected.description ? (
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{selected.description}</p>
              ) : null}

              <div className="mt-4 w-full rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5 text-left">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-700">
                  Kaise Milega · How to Earn
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-ink-800">
                  {describeBadgeCriteria(selected)}
                </p>
                {!selected.earned && parseBadgeAutoRule(selected.auto_rule).type !== 'manual' ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-bold text-brand-800">
                      <span>Your current progress</span>
                      <span>
                        {Math.min(selected.currentValue, selected.targetValue)} / {selected.targetValue} ({selected.progressPercent}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${selected.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {selected.earned ? (
                <div className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                  ✓ Unlocked
                  {selected.awarded_at
                    ? ` on ${new Date(selected.awarded_at).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : ''}
                  {selected.reason ? ` — ${selected.reason}` : ''}
                </div>
              ) : (
                <div className="mt-4 flex w-full gap-2">
                  <Link
                    href={selectedRuleMeta.actionHref}
                    onClick={() => setSelected(null)}
                    className="ecc-btn ecc-btn-brand flex-1 text-xs"
                  >
                    {selectedRuleMeta.actionLabel} <ArrowRight size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="ecc-btn ecc-btn-outline text-xs"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
