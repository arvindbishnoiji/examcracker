'use client';

/**
 * Representative preview for a screen document.
 *
 * It renders through the exact same scaffold components as the live student
 * pages (heading, announcement, section wrappers, help note, empty state) and
 * uses the configured layout/labels. Real records are intentionally not
 * fabricated here: placeholders stay clearly generic.
 */

import type {
  ChallengesScreenConfig,
  ChatScreenConfig,
  EventsScreenConfig,
  LeaderboardScreenConfig,
  LecturePlayerScreenConfig,
  LecturesScreenConfig,
  NotificationsScreenConfig,
  OnboardingScreenConfig,
  ProfileScreenConfig,
  ScreenBaseConfig,
  SearchScreenConfig,
  SiteConfig,
  TestPlayerScreenConfig,
  TestsScreenConfig,
} from '@/types';
import type { ScreenKey } from '@/lib/screen-config';
import { screenDefinition, screenSectionById, visibleSectionIds } from '@/lib/screen-config';
import {
  ScreenAnnouncementBanner,
  ScreenHelpNote,
  ScreenPageHeader,
  screenGridClass,
} from '@/components/student/ScreenScaffold';

function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-ink-100 ${className}`} aria-hidden />;
}

function CardPlaceholder({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
      <Bar className="mb-2 h-16 w-full" />
      {Array.from({ length: lines }).map((_, index) => (
        <Bar key={index} className={`mb-1.5 h-2 ${index === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
      <Bar className="mt-2 h-6 w-24 bg-brand-100" />
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-ink-200 bg-[var(--ec-surface)] px-2.5 py-1 text-[10px] font-bold text-ink-600">
      {label}
    </span>
  );
}

function ScreenBody({
  screenKey,
  config,
}: {
  screenKey: ScreenKey;
  config: ScreenBaseConfig;
}) {
  const ids = visibleSectionIds(screenKey, config);
  const grid = screenGridClass(config.layout);

  function sectionShell(id: string, node: React.ReactNode) {
    const section = screenSectionById(screenKey, config, id);
    return (
      <div key={id} className="space-y-1.5">
        {section?.title ? (
          <p className="text-[11px] font-extrabold text-ink-800">{section.title}</p>
        ) : null}
        {node}
      </div>
    );
  }

  if (screenKey === 'onboarding') {
    const cfg = config as OnboardingScreenConfig;
    return (
      <div className="space-y-2 rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
        {cfg.showBrandPanel ? (
          <div className="rounded-lg bg-brand-50 p-2.5">
            <p className="text-[8px] font-bold uppercase tracking-wide text-brand-700">{cfg.brandPanelEyebrow}</p>
            <p className="mt-0.5 line-clamp-3 text-[11px] font-extrabold text-ink-900">{cfg.brandPanelTitle}</p>
            <p className="mt-1 line-clamp-3 text-[9px] leading-relaxed text-ink-600">{cfg.brandPanelBody}</p>
          </div>
        ) : null}
        <p className="text-[9px] font-bold uppercase tracking-wide text-brand-700">{cfg.formEyebrow}</p>
        <p className="text-[12px] font-extrabold text-ink-900">{cfg.formTitle}</p>
        <div>
          <p className="text-[9px] font-semibold text-ink-700">{cfg.nameQuestion}</p>
          <div className="mt-1 rounded border border-ink-200 p-1.5 text-[9px] text-ink-400">{cfg.namePlaceholder}</div>
          <p className="mt-0.5 text-[8px] text-ink-400">{cfg.nameHelp}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-ink-700">{cfg.examQuestion}</p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {['JEE', 'NEET'].map((exam) => (
              <div key={exam} className="rounded border border-ink-200 p-1.5 text-[9px] font-semibold text-ink-700">{exam}</div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[9px] font-semibold text-ink-700">{cfg.classQuestion}</p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {['Class 11', 'Class 12'].map((cls) => (
              <div key={cls} className="rounded border border-ink-200 p-1.5 text-[9px] font-semibold text-ink-700">{cls}</div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[8px] text-ink-400">{cfg.requiredNotice}</span>
          <span className="rounded bg-brand-600 px-2 py-1 text-[9px] font-bold text-white">{cfg.finishLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ids.map((id) => {
        switch (screenKey) {
          case 'lectures': {
            const cfg = config as LecturesScreenConfig;
            if (id === 'tabs') {
              return sectionShell(
                id,
                <div className="flex flex-wrap gap-1.5">
                  <Pill label={cfg.tabLabels.batches} />
                  <Pill label={cfg.tabLabels.series} />
                  <Pill label={cfg.tabLabels.lectures} />
                  <Pill label={cfg.tabLabels.resources} />
                </div>
              );
            }
            if (id === 'filters') {
              return sectionShell(
                id,
                cfg.showFilters ? (
                  <div className="space-y-1.5">
                    {cfg.showSearch ? (
                      <div className="rounded-lg border border-ink-200 bg-[var(--ec-surface)] p-2 text-[10px] text-ink-400">
                        {cfg.searchPlaceholder || 'Search…'}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-500">
                      {cfg.showSort ? <Pill label={cfg.sortNewestLabel} /> : null}
                      <Pill label={cfg.mineFilterLabel} />
                    </div>
                  </div>
                ) : null
              );
            }
            if (id === 'catalogue') {
              return sectionShell(id, <div className={grid}>{[1, 2, 3].map((n) => <CardPlaceholder key={n} />)}</div>);
            }
            if (id === 'access_note') {
              return sectionShell(
                id,
                <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
                  <p className="text-[11px] font-bold text-ink-800">{cfg.accessNoteTitle}</p>
                  <p className="mt-0.5 line-clamp-4 text-[10px] leading-relaxed text-ink-500">{cfg.accessNoteBody}</p>
                </div>
              );
            }
            return null;
          }
          case 'lecturePlayer': {
            const cfg = config as LecturePlayerScreenConfig;
            if (id === 'video') {
              return sectionShell(
                id,
                <div>
                  <div className="grid aspect-video w-full place-items-center rounded-[var(--ec-radius)] bg-ink-900 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    Video player
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill label={cfg.markCompleteLabel} />
                    <Pill label={cfg.saveProgressLabel} />
                    <Pill label={cfg.previousLabel} />
                    <Pill label={cfg.nextLabel} />
                  </div>
                </div>
              );
            }
            if (id === 'notes') {
              return sectionShell(
                id,
                <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
                  <p className="text-[11px] font-bold text-ink-800">{cfg.notesTitle}</p>
                  <Bar className="mt-2 h-20 w-full" />
                </div>
              );
            }
            if (id === 'related') {
              return sectionShell(
                id,
                <div>
                  <p className="mb-1 text-[11px] font-bold text-ink-800">{cfg.relatedTitle}</p>
                  <div className="space-y-1.5">
                    {[1, 2].map((n) => (
                      <div key={n} className="flex gap-2 rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                        <Bar className="h-9 w-16" />
                        <div className="flex-1">
                          <Bar className="mb-1 h-2 w-full" />
                          <Bar className="h-2 w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (id === 'help') {
              return sectionShell(id, <p className="text-[10px] leading-relaxed text-ink-500">{cfg.progressNote}</p>);
            }
            return null;
          }
          case 'tests': {
            const cfg = config as TestsScreenConfig;
            if (id === 'filters') {
              return sectionShell(
                id,
                cfg.showFilters ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(cfg.filterLabels).map(([key, label]) => (
                      <Pill key={key} label={label} />
                    ))}
                    {cfg.showSearch ? <Pill label={cfg.searchPlaceholder} /> : null}
                  </div>
                ) : null
              );
            }
            if (id === 'catalogue') {
              return sectionShell(id, <div className={grid}>{[1, 2, 3].map((n) => <CardPlaceholder key={n} lines={3} />)}</div>);
            }
            if (id === 'info') {
              return sectionShell(
                id,
                <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
                  <p className="text-[11px] font-bold text-ink-800">{cfg.infoTitle}</p>
                  <p className="mt-0.5 line-clamp-4 text-[10px] leading-relaxed text-ink-500">{cfg.infoBody}</p>
                </div>
              );
            }
            return null;
          }
          case 'testPlayer': {
            const cfg = config as TestPlayerScreenConfig;
            if (id === 'instructions') {
              return sectionShell(
                id,
                cfg.showInstructions ? (
                  <div className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                    <p className="text-[10px] font-bold text-ink-800">{cfg.instructionsTitle}</p>
                    <ul className="mt-1 list-disc pl-3 text-[9px] text-ink-500">
                      {cfg.instructions.slice(0, 3).map((line, index) => (
                        <li key={index} className="line-clamp-2">{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null
              );
            }
            if (id === 'attempt') {
              return sectionShell(
                id,
                <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-ink-800">Question 1</p>
                    <Pill label={cfg.paletteTitle} />
                  </div>
                  <Bar className="mb-2 h-2 w-full" />
                  <Bar className="mb-2 h-2 w-4/5" />
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="mb-1 rounded border border-ink-100 p-1.5">
                      <Bar className="h-2 w-2/3" />
                    </div>
                  ))}
                  <div className="mt-2 flex justify-end">
                    <span className="rounded bg-brand-600 px-2 py-1 text-[9px] font-bold text-white">{cfg.submitLabel}</span>
                  </div>
                </div>
              );
            }
            if (id === 'warning') {
              return sectionShell(
                id,
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-[9px] text-amber-900">{cfg.submitConfirm}</p>
              );
            }
            if (id === 'review') {
              return sectionShell(id, <p className="text-[10px] text-ink-500">{cfg.reviewTitle}</p>);
            }
            return null;
          }
          case 'leaderboard': {
            const cfg = config as LeaderboardScreenConfig;
            if (id === 'selector') {
              return sectionShell(
                id,
                cfg.showTestSelector ? (
                  <div className="flex gap-1.5">
                    <div className="flex-1 rounded-lg border border-ink-200 bg-[var(--ec-surface)] p-2 text-[10px] text-ink-400">
                      {cfg.selectorLabel}
                    </div>
                    <Pill label={cfg.refreshLabel} />
                    <Pill label={cfg.browseCtaLabel} />
                  </div>
                ) : null
              );
            }
            if (id === 'ranking') {
              return sectionShell(
                id,
                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-ink-400">{cfg.rankLabel}</p>
                  {[1, 2, 3].map((rank) => (
                    <div key={rank} className="flex items-center gap-2 rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-100 text-[9px] font-bold">#{rank}</span>
                      {cfg.showAvatars ? <span className="h-6 w-6 rounded-full bg-ink-100" /> : null}
                      <Bar className="h-2 flex-1" />
                      <span className="text-[9px] font-bold text-ink-500">— / —</span>
                    </div>
                  ))}
                </div>
              );
            }
            if (id === 'info') {
              return sectionShell(
                id,
                <div>
                  <p className="text-[10px] font-bold text-ink-800">{cfg.infoTitle}</p>
                  <p className="text-[9px] leading-relaxed text-ink-500">{cfg.infoBody}</p>
                </div>
              );
            }
            return null;
          }
          case 'profile': {
            const cfg = config as ProfileScreenConfig;
            if (id === 'identity') {
              return sectionShell(
                id,
                <div className="flex items-center gap-2 rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">SN</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-ink-800">Student name</p>
                    <p className="text-[9px] text-ink-500">Exam · Class · account actions</p>
                  </div>
                </div>
              );
            }
            if (id === 'stats') {
              if (!cfg.showQuickStats) return null;
              return sectionShell(
                id,
                <div className="grid grid-cols-2 gap-1.5">
                  {['Tests taken', 'Average score', 'Lessons completed', 'Watch time'].map((label) => (
                    <div key={label} className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-ink-400">{label}</p>
                      <p className="text-[13px] font-extrabold text-ink-800">—</p>
                    </div>
                  ))}
                </div>
              );
            }
            if (id === 'level') {
              if (!cfg.showLevel) return null;
              return sectionShell(
                id,
                <div className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                  <p className="text-[10px] font-bold text-ink-800">Learning level</p>
                  <Bar className="mt-1 h-1.5 w-full" />
                  <p className="mt-1 line-clamp-2 text-[9px] text-ink-500">{cfg.levelNote}</p>
                </div>
              );
            }
            if (id === 'recent_attempts') {
              if (!cfg.showRecentAttempts) return null;
              return sectionShell(
                id,
                <div className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                  <p className="text-[10px] font-bold text-ink-800">{cfg.recentAttemptsTitle}</p>
                  <Bar className="mt-1.5 h-2 w-full" />
                  <Bar className="mt-1 h-2 w-5/6" />
                </div>
              );
            }
            if (id === 'lesson_progress') {
              if (!cfg.showLessonProgress) return null;
              return sectionShell(
                id,
                <div className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                  <p className="text-[10px] font-bold text-ink-800">{cfg.lessonProgressTitle}</p>
                  <Bar className="mt-1.5 h-2 w-full" />
                </div>
              );
            }
            if (id === 'score_summary') {
              if (!cfg.showScoreSummary) return null;
              return sectionShell(
                id,
                <div className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                  <p className="text-[10px] font-bold text-ink-800">{cfg.scoreSummaryTitle}</p>
                  <Bar className="mt-1.5 h-1.5 w-full" />
                </div>
              );
            }
            if (id === 'quick_links') {
              if (!cfg.showQuickLinks) return null;
              return sectionShell(
                id,
                <div className="flex flex-wrap gap-1.5">
                  {['Home', 'Tests', 'Lectures', 'Leaderboard'].map((label) => (
                    <Pill key={label} label={label} />
                  ))}
                </div>
              );
            }
            return null;
          }
          case 'eventsScreen': {
            const cfg = config as EventsScreenConfig;
            if (id === 'calendar') {
              if (!cfg.showCalendar) return null;
              return sectionShell(
                id,
                <div className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 28 }).map((_, index) => (
                      <span key={index} className="aspect-square rounded bg-ink-50" />
                    ))}
                  </div>
                  <p className="mt-1 text-[8px] text-ink-500">{cfg.calendarNote}</p>
                </div>
              );
            }
            if (id === 'list') {
              return sectionShell(id, <div className={grid}>{[1, 2].map((n) => <CardPlaceholder key={n} />)}</div>);
            }
            if (id === 'info') {
              return sectionShell(
                id,
                <div>
                  <p className="text-[10px] font-bold text-ink-800">{cfg.infoTitle}</p>
                  <p className="line-clamp-3 text-[9px] leading-relaxed text-ink-500">{cfg.infoBody}</p>
                </div>
              );
            }
            return null;
          }
          case 'challengesScreen': {
            const cfg = config as ChallengesScreenConfig;
            if (id === 'list') {
              return sectionShell(
                id,
                <div className="space-y-1.5">
                  {[1, 2].map((n) => (
                    <div key={n} className="rounded-lg border border-ink-100 border-t-4 border-t-brand-500 bg-[var(--ec-surface)] p-2">
                      <p className="text-[10px] font-bold text-ink-800">Challenge title</p>
                      <Bar className="mt-1 h-2 w-3/4" />
                      <div className="mt-1.5 flex items-center justify-between">
                        {cfg.showSchedule ? <span className="text-[8px] text-ink-500">Schedule</span> : <span />}
                        <span className="rounded bg-brand-600 px-2 py-0.5 text-[8px] font-bold text-white">{cfg.joinLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (id === 'info') {
              return sectionShell(
                id,
                <p className="text-[9px] leading-relaxed text-ink-500">{cfg.help.body || cfg.joinHint}</p>
              );
            }
            return null;
          }
          case 'chat': {
            const cfg = config as ChatScreenConfig;
            if (id === 'thread') {
              return sectionShell(
                id,
                <div className="rounded-[var(--ec-radius)] border border-ink-100 bg-[var(--ec-surface)] p-2">
                  <div className="space-y-1.5">
                    <div className="rounded-xl rounded-bl-sm border border-ink-100 bg-ink-50 p-1.5 text-[9px] text-ink-500">
                      Mentor reply
                    </div>
                    <div className="ml-6 rounded-xl rounded-br-sm bg-brand-600 p-1.5 text-[9px] text-white">
                      Student message
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <div className="flex-1 rounded-full border border-ink-200 p-1.5 text-[9px] text-ink-400">
                      {cfg.composerPlaceholder}
                    </div>
                    <Pill label={cfg.sendLabel} />
                  </div>
                </div>
              );
            }
            if (id === 'help') {
              return sectionShell(
                id,
                <div>
                  <p className="text-[10px] font-bold text-ink-800">{cfg.helpTitle}</p>
                  <p className="line-clamp-3 text-[9px] leading-relaxed text-ink-500">{cfg.helpBody}</p>
                </div>
              );
            }
            return null;
          }
          case 'notifications': {
            const cfg = config as NotificationsScreenConfig;
            if (id === 'list') {
              return sectionShell(
                id,
                <div className="space-y-1.5">
                  {[1, 2].map((n) => (
                    <div key={n} className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                      <div className="flex items-center justify-between">
                        <Bar className="h-2 w-24" />
                        <Pill label={n === 1 ? cfg.unreadLabel : cfg.readLabel} />
                      </div>
                      <Bar className="mt-1.5 h-2 w-full" />
                    </div>
                  ))}
                </div>
              );
            }
            if (id === 'info') {
              return sectionShell(id, <p className="text-[9px] leading-relaxed text-ink-500">{cfg.help.body}</p>);
            }
            return null;
          }
          case 'search': {
            const cfg = config as SearchScreenConfig;
            if (id === 'suggestions') {
              if (!cfg.showSuggestions) return null;
              return sectionShell(
                id,
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-bold text-ink-500">{cfg.suggestionsTitle}</span>
                  {cfg.suggestions.slice(0, 4).map((suggestion) => (
                    <Pill key={suggestion} label={suggestion} />
                  ))}
                </div>
              );
            }
            if (id === 'kind_filters') {
              if (!cfg.showKindFilters) return null;
              return sectionShell(
                id,
                <div className="flex flex-wrap gap-1.5">
                  {['All', 'Lecture', 'Test', 'Batch'].map((label) => (
                    <Pill key={label} label={label} />
                  ))}
                </div>
              );
            }
            if (id === 'results') {
              return sectionShell(
                id,
                <div className="space-y-1.5">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="rounded-lg border border-ink-100 bg-[var(--ec-surface)] p-2">
                      <Bar className="h-2 w-2/3" />
                      <Bar className="mt-1 h-2 w-full" />
                    </div>
                  ))}
                </div>
              );
            }
            if (id === 'info') {
              return sectionShell(id, <p className="text-[9px] leading-relaxed text-ink-500">{cfg.infoNote}</p>);
            }
            return null;
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

export function ScreenPreview({
  screenKey,
  config,
}: {
  screenKey: ScreenKey;
  config: SiteConfig[ScreenKey];
}) {
  const base = config as ScreenBaseConfig;
  const definition = screenDefinition(screenKey);
  return (
    <div className="min-h-[420px] rounded-xl border border-ink-200 bg-[var(--ec-bg)] p-3">
      <div className="ec-header mb-2 flex items-center justify-between rounded-lg border px-2 py-1.5">
        <span className="text-[9px] font-bold text-ink-600">Student app header</span>
        <span className="text-[8px] text-ink-400">{definition.route}</span>
      </div>
      <div className="space-y-3 rounded-lg bg-[var(--ec-bg)]">
        <ScreenPageHeader
          headingLevel="h2"
          showHeader={base.showHeader}
          eyebrow={base.eyebrow}
          title={base.pageTitle}
          description={base.pageSubtitle}
        />
        <ScreenAnnouncementBanner announcement={base.announcement} />
        <ScreenBody screenKey={screenKey} config={base} />
        <ScreenHelpNote help={base.help} />
      </div>
    </div>
  );
}
