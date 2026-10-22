'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Check,
  Code2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { AdminPageHeader, Field, Panel, StatusPill, Toggle } from '@/components/admin/ui';
import { ImageField } from '@/components/admin/ImageField';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import {
  awardAdminBadge,
  deleteAdminBadge,
  getAdminBadges,
  revokeAdminBadge,
  saveAdminBadge,
  searchAdminStudents,
} from '@/lib/api';
import type {
  BadgeAnimationPreset,
  BadgeAutoRuleType,
  BadgeAwardRecord,
  BadgeCategory,
  BadgeDefinition,
  BadgeRarity,
} from '@/types';
import {
  BADGE_ANIMATION_OPTIONS,
  BADGE_AUTO_RULE_OPTIONS,
  BADGE_CODE_TEMPLATES,
  describeBadgeCriteria,
  parseBadgeAutoRule,
  rarityMeta,
} from '@/lib/badge-animations';
import { AnimatedBadge } from '@/components/student/AnimatedBadge';
import { useToast } from '@/hooks/useToast';

const CATEGORIES: Array<{ value: BadgeCategory; label: string }> = [
  { value: 'achievement', label: 'Achievement' },
  { value: 'consistency', label: 'Consistency / Streak' },
  { value: 'test_performance', label: 'Mock Test Ranker' },
  { value: 'course_completion', label: 'Syllabus Complete' },
  { value: 'community', label: 'Community Star' },
  { value: 'verified', label: 'Verified Scholar Tick' },
  { value: 'custom', label: 'Special Honour' },
];

const RARITIES: Array<{ value: BadgeRarity; label: string; hint: string }> = [
  { value: 'standard', label: 'Standard', hint: 'Clean indigo medal' },
  { value: 'rare', label: 'Rare', hint: 'Sky-blue crystal frame' },
  { value: 'epic', label: 'Epic', hint: 'Royal violet aura' },
  { value: 'legendary', label: 'Legendary', hint: 'Gold champion frame' },
];

const QUICK_CRITERIA_CHIPS = [
  'Complete 5 lectures in your enrolled batch',
  'Score 85% or above in any live mock test',
  'Submit 3 weekly mock tests with full discipline',
  'Complete 2 hours of focused lecture study',
  'Finish 100% chapters of a subject series',
];

interface DraftState {
  id?: string;
  title: string;
  description: string;
  criteria: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  image_url: string;
  animation_preset: BadgeAnimationPreset;
  animation_code: string;
  rule_type: BadgeAutoRuleType;
  rule_target: number;
  active: boolean;
  sort_order: number;
}

type StudentSearchResult = {
  firebase_uid: string;
  display_name: string;
  email: string | null;
  exam: string;
  class_level: string;
};

const EMPTY_DRAFT: DraftState = {
  title: '',
  description: '',
  criteria: '',
  category: 'achievement',
  rarity: 'epic',
  image_url: '',
  animation_preset: 'shimmer',
  animation_code: '',
  rule_type: 'manual',
  rule_target: 5,
  active: true,
  sort_order: 0,
};

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }) + ' IST';
}

export function BadgesSection() {
  const { push } = useToast();
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminBadges>> | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showCodeStudio, setShowCodeStudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [studentQuery, setStudentQuery] = useState('');
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awardBusy, setAwardBusy] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<BadgeAwardRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setData(await getAdminBadges());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load badges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const query = studentQuery.trim();
    if (query.length < 2) {
      setStudents([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchAdminStudents({ query, page: 1, pageSize: 8 })
        .then((result) => {
          if (active) setStudents(result.items);
        })
        .catch(() => {
          if (active) setStudents([]);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [studentQuery]);

  function startEdit(badge: BadgeDefinition) {
    const rule = parseBadgeAutoRule(badge.auto_rule);
    const hasCustomCode = Boolean((badge.animation_code || '').trim());
    setDraft({
      id: badge.id,
      title: badge.title,
      description: badge.description || '',
      criteria: badge.criteria || '',
      category: badge.category,
      rarity: badge.rarity,
      image_url: badge.image_url || '',
      animation_preset: badge.animation_preset || 'shimmer',
      animation_code: badge.animation_code || '',
      rule_type: rule.type,
      rule_target: rule.target || 5,
      active: Boolean(badge.active),
      sort_order: badge.sort_order || 0,
    });
    setShowCodeStudio(hasCustomCode || badge.animation_preset === 'custom');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (draft.title.trim().length < 2) {
      push('Enter a badge name (at least 2 characters).', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveAdminBadge({
        id: draft.id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        criteria: draft.criteria.trim(),
        category: draft.category,
        rarity: draft.rarity,
        imageUrl: draft.image_url.trim(),
        animationPreset: draft.animation_preset,
        animationCode: draft.animation_code.trim(),
        autoRule: {
          type: draft.rule_type,
          target: draft.rule_type === 'manual' ? 0 : draft.rule_type === 'profile_complete' ? 1 : Math.max(1, Number(draft.rule_target) || 1),
        },
        active: draft.active,
        sortOrder: Number(draft.sort_order) || 0,
      });
      setDraft(EMPTY_DRAFT);
      setShowCodeStudio(false);
      await refresh();
      push(draft.id ? 'Badge updated successfully!' : 'New animated badge created!', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Badge could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveBadge(badge: BadgeDefinition) {
    try {
      const res = await deleteAdminBadge(badge.id);
      if (draft.id === badge.id) setDraft(EMPTY_DRAFT);
      await refresh();
      push(
        res.deleted
          ? `Badge "${badge.title}" deleted.`
          : `Badge "${badge.title}" had student awards so it was marked inactive.`,
        'success'
      );
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not remove badge.', 'error');
    }
  }

  async function handleAward(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUid || !selectedBadge) return;
    setAwardBusy(true);
    try {
      const result = await awardAdminBadge(selectedBadge, selectedUid, awardReason.trim());
      push(
        result.alreadyAwarded ? 'This student already holds this badge.' : 'Badge awarded to student!',
        result.alreadyAwarded ? 'info' : 'success'
      );
      setSelectedUid('');
      setStudentQuery('');
      setStudents([]);
      setAwardReason('');
      await refresh();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Award could not be completed.', 'error');
    } finally {
      setAwardBusy(false);
    }
  }

  async function handleRevoke(event: React.FormEvent) {
    event.preventDefault();
    if (!revokeTarget || revokeReason.trim().length < 3) return;
    setRevokeBusy(true);
    try {
      await revokeAdminBadge(revokeTarget.id, revokeReason.trim());
      push('Badge removed from student profile.', 'success');
      setRevokeTarget(null);
      setRevokeReason('');
      await refresh();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not revoke badge.', 'error');
    } finally {
      setRevokeBusy(false);
    }
  }

  const activeRuleOption =
    BADGE_AUTO_RULE_OPTIONS.find((item) => item.type === draft.rule_type) || BADGE_AUTO_RULE_OPTIONS[0];

  const previewBadge = {
    title: draft.title.trim() || 'Physics Maharathi',
    description: draft.description.trim() || 'Recognises dedicated chapter mastery',
    criteria: draft.criteria.trim(),
    category: draft.category,
    rarity: draft.rarity,
    image_url: draft.image_url,
    animation_preset: draft.animation_preset,
    animation_code: draft.animation_code,
    auto_rule: { type: draft.rule_type, target: draft.rule_target },
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Badges & Rewards Studio"
        title="Create & Award Animated Badges"
        description="Upload a badge image, give it a clear name, write how students earn it (Kaise Milega), and add preset or custom CSS/JS animations with live preview."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}{' '}
          <button
            type="button"
            className="ml-2 font-semibold underline"
            onClick={() => {
              setLoading(true);
              void refresh();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {[
          ['Total Badges', data?.counts.definitions ?? '—'],
          ['Student Awards', data?.counts.activeAwards ?? '—'],
          ['Verified Scholars', data?.counts.verifiedStudents ?? '—'],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-3.5 sm:p-4">
            <p className="text-[11px] font-semibold text-ink-500">{label}</p>
            <p className="mt-1 text-xl font-extrabold tabular-nums sm:text-2xl">{loading ? '…' : value}</p>
          </Card>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        {/* LEFT: STEP-BY-STEP BADGE CREATOR */}
        <Panel
          title={draft.id ? `Editing Badge: ${draft.title || 'Untitled'}` : 'Create New Badge'}
          description="Follow the 3 simple steps below — Image + Name → Kaise Milega → Animation."
          action={
            draft.id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(EMPTY_DRAFT);
                  setShowCodeStudio(false);
                }}
              >
                <X size={13} className="mr-1" /> Cancel edit
              </Button>
            ) : null
          }
        >
          <form className="space-y-5" onSubmit={(event) => void handleSave(event)}>
            {/* STEP 1: IMAGE UPLOAD + NAME */}
            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3.5 sm:p-4 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-extrabold text-white">
                  1
                </span>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-800">
                  Badge Image &amp; Name
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-[var(--ec-surface)] p-3.5 sm:flex-row sm:items-center">
                <div className="shrink-0 self-center sm:self-start pt-1">
                  <AnimatedBadge badge={previewBadge} size="lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <ImageField
                    label="Badge Artwork (URL or Google Drive Upload)"
                    help="Paste an https:// image link OR upload directly to Google Drive (with optional square crop, zoom & rotate — just like Profile Photo)."
                    context="badge"
                    preferSquareCrop
                    value={draft.image_url}
                    onChange={(image_url) => setDraft((prev) => ({ ...prev, image_url }))}
                    placeholder="https://…/badge.png (or upload below)"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Badge Name (Badge ka naam)" required>
                  <input
                    className="ec-field"
                    required
                    minLength={2}
                    maxLength={80}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Physics Maharathi / Mock Topper"
                  />
                </Field>
                <Field label="Category">
                  <select
                    className="ec-field"
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as BadgeCategory })}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Short Tagline (optional)">
                <input
                  className="ec-field"
                  maxLength={280}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="e.g. Awarded for outstanding problem-solving speed & accuracy"
                />
              </Field>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-ink-700">Rarity Frame Style</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RARITIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, rarity: item.value })}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        draft.rarity === item.value
                          ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-300'
                          : 'border-ink-200 bg-[var(--ec-surface)] hover:bg-ink-50'
                      }`}
                    >
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span className="block text-[10px] text-ink-500">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 2: KAISE MILEGA (HOW TO EARN + AUTO UNLOCK RULE) */}
            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3.5 sm:p-4 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-extrabold text-white">
                  2
                </span>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-800">
                  Kaise Milega · How Students Earn This Badge
                </p>
              </div>

              <Field
                label="How will a student earn this badge? (Student ko dikhne wala rule)"
                help="Students see this clearly under every locked & earned badge."
              >
                <textarea
                  className="ec-field min-h-[76px]"
                  maxLength={1000}
                  value={draft.criteria}
                  onChange={(e) => setDraft({ ...draft, criteria: e.target.value })}
                  placeholder="e.g. Complete 5 lectures in Physics or score 85%+ in Sunday Mock Test"
                />
              </Field>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_CRITERIA_CHIPS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, criteria: sample }))}
                    className="rounded-full border border-ink-200 bg-[var(--ec-surface)] px-2.5 py-1 text-[10.5px] font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    + {sample}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
                <Field
                  label="Unlock Mode"
                  help="Auto-unlock awards the badge automatically from real lecture/test data in D1."
                >
                  <select
                    className="ec-field"
                    value={draft.rule_type}
                    onChange={(e) => {
                      const nextType = e.target.value as BadgeAutoRuleType;
                      const meta = BADGE_AUTO_RULE_OPTIONS.find((o) => o.type === nextType);
                      setDraft((prev) => ({
                        ...prev,
                        rule_type: nextType,
                        rule_target: meta?.defaultTarget ?? 5,
                        criteria:
                          prev.criteria.trim() || !meta
                            ? prev.criteria
                            : meta.sampleCriteria(meta.defaultTarget || 1),
                      }));
                    }}
                  >
                    {BADGE_AUTO_RULE_OPTIONS.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {activeRuleOption.unitLabel ? (
                  <Field label={activeRuleOption.unitLabel}>
                    <input
                      type="number"
                      min={1}
                      max={draft.rule_type === 'best_score_pct' || draft.rule_type === 'avg_score_pct' ? 100 : 10000}
                      className="ec-field"
                      value={draft.rule_target}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setDraft((prev) => ({ ...prev, rule_target: val }));
                      }}
                    />
                  </Field>
                ) : null}
              </div>
            </div>

            {/* STEP 3: ANIMATION PRESETS + CUSTOM CODE STUDIO */}
            <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3.5 sm:p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-extrabold text-white">
                    3
                  </span>
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-800">
                    Badge Animation (Presets + Custom Coding)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCodeStudio((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-700 hover:bg-brand-100"
                >
                  <Code2 size={13} />
                  {showCodeStudio ? 'Hide Custom Code Editor' : 'Write Custom CSS / JS Animation'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BADGE_ANIMATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, animation_preset: opt.id }));
                      if (opt.id === 'custom') setShowCodeStudio(true);
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      draft.animation_preset === opt.id
                        ? 'border-brand-500 bg-brand-50/80 ring-1 ring-brand-300'
                        : 'border-ink-200 bg-[var(--ec-surface)] hover:bg-ink-50'
                    }`}
                  >
                    <span className="flex items-center justify-between text-xs font-bold">
                      {opt.label}
                      {draft.animation_preset === opt.id ? <Check size={12} className="text-brand-600" /> : null}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-ink-500">{opt.hint}</span>
                  </button>
                ))}
              </div>

              {showCodeStudio ? (
                <div className="space-y-3 rounded-2xl border border-ink-200 bg-[var(--ec-surface)] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
                        <Wand2 size={14} className="text-brand-600" /> One-Click Coded Animation Templates
                      </p>
                      <p className="text-[11px] text-ink-500">
                        Pick any template below or write your own CSS <code>@keyframes</code> (<code>.badge-wrap</code>,{' '}
                        <code>.badge-ring</code>, <code>.badge-img</code>, <code>.badge-fx</code>) or HTML/Canvas/JS!
                      </p>
                    </div>
                    {draft.animation_code ? (
                      <button
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, animation_code: '' }))}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                      >
                        Clear custom code
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {BADGE_CODE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            animation_preset: 'custom',
                            animation_code: tpl.code,
                          }))
                        }
                        className="rounded-xl border border-ink-200 bg-ink-50/60 p-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <span className="block text-[11px] font-bold text-ink-900">{tpl.name}</span>
                        <span className="block text-[10px] text-ink-500">{tpl.subtitle}</span>
                      </button>
                    ))}
                  </div>

                  <Field label="Custom Animation Code (CSS @keyframes or HTML + JS)">
                    <textarea
                      className="ec-code !min-h-[165px]"
                      spellCheck={false}
                      value={draft.animation_code}
                      onChange={(e) => setDraft({ ...draft, animation_code: e.target.value })}
                      placeholder={`.badge-wrap {\n  animation: floatPop 3s ease-in-out infinite;\n}\n@keyframes floatPop {\n  50% { transform: translateY(-5px) scale(1.06); }\n}`}
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px] items-center">
              <Toggle
                checked={draft.active}
                onChange={(active) => setDraft({ ...draft, active })}
                label="Visible to students"
                description="Active badges show on student profiles & home showcase."
              />
              <Field label="Sort order">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  className="ec-field"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button type="submit" loading={saving}>
                <Sparkles size={15} className="mr-1.5" />
                {draft.id ? 'Save Badge Changes' : 'Create Animated Badge'}
              </Button>
              {draft.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(EMPTY_DRAFT);
                    setShowCodeStudio(false);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>

        {/* RIGHT: STICKY LIVE STUDENT PREVIEW + MANUAL AWARD */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Panel
            title="Live Student Preview"
            description="Exactly how students see this badge & Kaise Milega card on mobile and desktop."
          >
            <div className={`rounded-2xl border p-5 text-center ${rarityMeta(previewBadge.rarity).cardClass}`}>
              <div className="py-2">
                <AnimatedBadge badge={previewBadge} size="xl" />
              </div>
              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                  rarityMeta(previewBadge.rarity).pillClass
                }`}
              >
                {rarityMeta(previewBadge.rarity).label}
              </span>
              <h3 className="mt-2 text-lg font-extrabold text-ink-900">{previewBadge.title}</h3>
              <p className="mt-0.5 text-xs text-ink-500">{previewBadge.description}</p>
              {draft.category === 'verified' ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                  <ShieldCheck size={14} /> Adds blue Verified Scholar tick on profile
                </p>
              ) : null}

              <div className="mt-4 rounded-xl border border-brand-100 bg-white/90 p-3 text-left">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-brand-700">
                  Kaise Milega · How to Earn
                </p>
                <p className="mt-1 text-xs font-medium text-ink-800">{describeBadgeCriteria(previewBadge)}</p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Award Badge to a Student"
            description="Search any student by name or email and grant a badge directly."
          >
            <form className="space-y-3" onSubmit={(event) => void handleAward(event)}>
              <Field label="Search Student" required>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-3 text-ink-400" />
                  <input
                    className="ec-field pl-9"
                    value={studentQuery}
                    onChange={(e) => {
                      setStudentQuery(e.target.value);
                      setSelectedUid('');
                    }}
                    placeholder="Type student name or email…"
                    autoComplete="off"
                  />
                </div>
              </Field>
              {students.length > 0 ? (
                <div
                  className="max-h-44 overflow-auto rounded-xl border border-ink-200 bg-[var(--ec-surface)]"
                  role="listbox"
                  aria-label="Student search results"
                >
                  {students.map((student) => (
                    <button
                      type="button"
                      key={student.firebase_uid}
                      role="option"
                      aria-selected={selectedUid === student.firebase_uid}
                      className="block w-full border-b border-ink-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-brand-50"
                      onClick={() => {
                        setSelectedUid(student.firebase_uid);
                        setStudentQuery(`${student.display_name} · ${student.email || student.firebase_uid}`);
                        setStudents([]);
                      }}
                    >
                      <span className="block font-semibold">{student.display_name}</span>
                      <span className="text-xs text-ink-500">
                        {student.email || student.firebase_uid} · {student.exam} · Class {student.class_level}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedUid ? <StatusPill tone="success">Student selected ✓</StatusPill> : null}

              <Field label="Select Badge" required>
                <select
                  className="ec-field"
                  required
                  value={selectedBadge}
                  onChange={(e) => setSelectedBadge(e.target.value)}
                >
                  <option value="">Choose a badge…</option>
                  {(data?.items || [])
                    .filter((item) => Boolean(item.active))
                    .map((badge) => (
                      <option key={badge.id} value={badge.id}>
                        {badge.title} ({badge.rarity})
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Congratulatory Note (optional)">
                <input
                  className="ec-field"
                  maxLength={500}
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  placeholder="e.g. Topped Sunday Physics Mock Test!"
                />
              </Field>

              <Button type="submit" loading={awardBusy} disabled={!selectedUid || !selectedBadge} className="w-full">
                <Plus size={15} className="mr-1.5" /> Give Badge to Student
              </Button>
            </form>
          </Panel>
        </div>
      </div>

      {/* ALL CREATED BADGES */}
      <Panel title="All Created Badges" description="Tap Edit to update image, Kaise Milega rules, or animation code.">
        {!data?.items.length ? (
          <EmptyState
            title="No badges created yet"
            description="Use the form above to upload your first badge image, add Kaise Milega rules, and publish it."
            icon={<Award size={20} />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((badge) => {
              const rule = parseBadgeAutoRule(badge.auto_rule);
              return (
                <div
                  key={badge.id}
                  className="flex min-w-0 items-start gap-3.5 rounded-2xl border border-ink-200/80 bg-[var(--ec-surface)] p-3.5"
                >
                  <div className="shrink-0 pt-0.5">
                    <AnimatedBadge badge={badge} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-ink-900">{badge.title}</p>
                      {!badge.active ? <StatusPill tone="neutral">Hidden</StatusPill> : null}
                      {rule.type !== 'manual' ? <StatusPill tone="brand">Auto</StatusPill> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{describeBadgeCriteria(badge)}</p>
                    <p className="mt-1.5 text-[11px] font-semibold text-ink-400">
                      {badge.active_awards || 0} earned · {badge.rarity}
                      {(badge.animation_code || '').trim() ? ' · custom code fx' : ` · ${badge.animation_preset || 'shimmer'}`}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startEdit(badge)}>
                        Edit
                      </Button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveBadge(badge)}
                        aria-label={`Delete ${badge.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ACTIVE STUDENT AWARDS */}
      <Panel title="Students Holding Badges" description="Currently active student badges.">
        {!data?.activeAwards.length ? (
          <EmptyState
            title="No badges awarded yet"
            description="Students who unlock badges automatically or receive manual awards appear here."
            icon={<Award size={20} />}
          />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.activeAwards.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/40 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AnimatedBadge
                    badge={{
                      title: record.badge_title,
                      category: record.category,
                      rarity: record.rarity,
                      image_url: record.image_url,
                      animation_preset: record.animation_preset,
                      animation_code: record.animation_code,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">
                      {record.badge_title}{' '}
                      <span className="font-medium text-ink-500">
                        → {record.display_name || record.email || record.firebase_uid}
                      </span>
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {timeLabel(record.awarded_at)}
                      {record.reason ? ` · ${record.reason}` : ''}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRevokeTarget(record)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {revokeTarget ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRevokeTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-title"
            className="w-full max-w-md rounded-2xl bg-[var(--ec-surface)] p-5 shadow-xl"
          >
            <h2 id="revoke-title" className="text-lg font-bold">
              Remove {revokeTarget.badge_title}?
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              This removes the badge from {revokeTarget.display_name || 'the student'}&apos;s profile.
            </p>
            <form className="mt-4 space-y-3" onSubmit={(event) => void handleRevoke(event)}>
              <Field label="Reason" required>
                <textarea
                  autoFocus
                  minLength={3}
                  maxLength={500}
                  required
                  className="ec-field min-h-24"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Short note (3+ characters)…"
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRevokeTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" loading={revokeBusy}>
                  Confirm remove
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
