import type {
  BadgeAnimationPreset,
  BadgeAutoRule,
  BadgeAutoRuleType,
  BadgeCategory,
  BadgeRarity,
} from '@/types';

export interface BadgePresetOption {
  id: BadgeAnimationPreset;
  label: string;
  hint: string;
}

export const BADGE_ANIMATION_OPTIONS: BadgePresetOption[] = [
  { id: 'shimmer', label: 'Metallic Shine', hint: 'Smooth diagonal light sweep across the medal' },
  { id: 'halo', label: 'Royal Aura', hint: 'Soft glowing pulse ring around the badge' },
  { id: 'orbit', label: 'Star Orbit', hint: 'Rotating golden ring with star accent' },
  { id: 'float', label: '3D Float', hint: 'Gentle levitating trophy motion' },
  { id: 'flame', label: 'Ranker Flame', hint: 'Warm energetic golden-orange aura' },
  { id: 'prism', label: 'Diamond Prism', hint: 'Holographic multi-colour border sheen' },
  { id: 'none', label: 'Static Clean', hint: 'Crisp still badge without motion' },
  { id: 'custom', label: 'Custom Code', hint: 'Write or customize your own CSS / HTML / JS animation' },
];

export interface BadgeCodeTemplate {
  id: string;
  name: string;
  subtitle: string;
  code: string;
}

export const BADGE_CODE_TEMPLATES: BadgeCodeTemplate[] = [
  {
    id: 'golden-crown',
    name: 'Golden Topper Aura',
    subtitle: ' pulsing gold glow + gentle tilt',
    code: `.badge-wrap {
  animation: topperFloat 3.2s ease-in-out infinite;
}
.badge-ring {
  box-shadow: 0 0 0 2px #f59e0b, 0 0 22px rgba(245, 158, 11, 0.55);
}
.badge-fx::after {
  content: "✦";
  position: absolute;
  top: -6px;
  right: -4px;
  font-size: 14px;
  color: #f59e0b;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.9);
  animation: starTwinkle 1.6s ease-in-out infinite;
}
@keyframes topperFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.05); }
}
@keyframes starTwinkle {
  0%, 100% { transform: scale(0.85) rotate(0deg); opacity: 0.7; }
  50% { transform: scale(1.3) rotate(22deg); opacity: 1; }
}`,
  },
  {
    id: 'chakra-ring',
    name: 'Spinning Energy Ring',
    subtitle: 'Rotating dashed halo around badge image',
    code: `.badge-fx::before {
  content: "";
  position: absolute;
  inset: -5px;
  border-radius: 999px;
  border: 2px dashed #7c3aed;
  animation: spinRing 9s linear infinite;
}
.badge-img {
  animation: subtlePulse 2.6s ease-in-out infinite;
}
@keyframes spinRing {
  to { transform: rotate(360deg); }
}
@keyframes subtlePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}`,
  },
  {
    id: 'coin-3d',
    name: '3D Trophy Gleam',
    subtitle: 'Smooth 3D perspective rocking motion',
    code: `.badge-wrap {
  perspective: 500px;
}
.badge-ring {
  animation: medal3d 4s ease-in-out infinite;
  box-shadow: 0 12px 24px -10px rgba(91, 33, 182, 0.55);
}
@keyframes medal3d {
  0%, 100% { transform: rotateY(-14deg) rotateX(6deg); }
  50% { transform: rotateY(14deg) rotateX(-6deg) translateY(-3px); }
}`,
  },
  {
    id: 'neon-cyber',
    name: 'Cyber Ranker Pulse',
    subtitle: 'Electric cyan + violet neon border wave',
    code: `.badge-ring {
  box-shadow: 0 0 0 2px #06b6d4, 0 0 18px rgba(6, 182, 212, 0.55);
  animation: neonWave 2.4s ease-in-out infinite;
}
@keyframes neonWave {
  0%, 100% {
    box-shadow: 0 0 0 2px #06b6d4, 0 0 14px rgba(6, 182, 212, 0.5);
  }
  50% {
    box-shadow: 0 0 0 2.5px #8b5cf6, 0 0 24px rgba(139, 92, 246, 0.72);
    transform: scale(1.04);
  }
}`,
  },
  {
    id: 'streak-fire',
    name: 'Streak Fire Halo',
    subtitle: 'Warm flame pulse for daily consistency',
    code: `.badge-ring {
  animation: fireGlow 1.9s ease-in-out infinite;
}
.badge-fx::after {
  content: "🔥";
  position: absolute;
  bottom: -6px;
  right: -5px;
  font-size: 13px;
  animation: flameBob 1.3s ease-in-out infinite;
}
@keyframes fireGlow {
  0%, 100% { box-shadow: 0 0 0 2px #fb923c, 0 0 12px rgba(249, 115, 22, 0.45); }
  50% { box-shadow: 0 0 0 3px #ef4444, 0 0 22px rgba(239, 68, 68, 0.65); }
}
@keyframes flameBob {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.18); }
}`,
  },
  {
    id: 'canvas-sparks',
    name: 'Live Particle Burst (HTML + JS)',
    subtitle: 'Animated golden sparks orbiting in real time',
    code: `<canvas id="sparks"></canvas>
<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; }
</style>
<script>
  const c = document.getElementById('sparks');
  const ctx = c.getContext('2d');
  c.width = 160; c.height = 160;
  const pts = Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * Math.PI * 2,
    r: 52 + (i % 3) * 7,
    s: 0.02 + (i % 4) * 0.005,
    sz: 2 + (i % 2) * 1.5
  }));
  (function frame() {
    ctx.clearRect(0, 0, 160, 160);
    for (const p of pts) {
      p.a += p.s;
      const x = 80 + Math.cos(p.a) * p.r;
      const y = 80 + Math.sin(p.a) * p.r;
      ctx.beginPath();
      ctx.fillStyle = p.sz > 2.5 ? '#f59e0b' : '#8b5cf6';
      ctx.arc(x, y, p.sz, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
</script>`,
  },
];

export const BADGE_AUTO_RULE_OPTIONS: Array<{
  type: BadgeAutoRuleType;
  label: string;
  unitLabel: string;
  defaultTarget: number;
  sampleCriteria: (target: number) => string;
  actionHref: string;
  actionLabel: string;
}> = [
  {
    type: 'manual',
    label: 'Manual Award by Admin / Mentor',
    unitLabel: '',
    defaultTarget: 0,
    sampleCriteria: () => 'Awarded personally by mentors for standout performance or discipline.',
    actionHref: '/lectures',
    actionLabel: 'Continue learning',
  },
  {
    type: 'lectures_completed',
    label: 'Auto-unlock: Complete X Lectures',
    unitLabel: 'Lectures to complete',
    defaultTarget: 5,
    sampleCriteria: (n) => `Complete ${n} lecture${n === 1 ? '' : 's'} across your enrolled subjects.`,
    actionHref: '/lectures',
    actionLabel: 'Watch lectures',
  },
  {
    type: 'tests_taken',
    label: 'Auto-unlock: Submit X Mock Tests',
    unitLabel: 'Mock tests to submit',
    defaultTarget: 3,
    sampleCriteria: (n) => `Attempt and submit ${n} timed mock test${n === 1 ? '' : 's'}.`,
    actionHref: '/tests',
    actionLabel: 'Attempt a test',
  },
  {
    type: 'best_score_pct',
    label: 'Auto-unlock: Score at least X% in a Test',
    unitLabel: 'Target score percentage (%)',
    defaultTarget: 80,
    sampleCriteria: (n) => `Achieve at least ${n}% marks in any scheduled or live test.`,
    actionHref: '/tests',
    actionLabel: 'Practice mock tests',
  },
  {
    type: 'avg_score_pct',
    label: 'Auto-unlock: Maintain X% Average Score',
    unitLabel: 'Average percentage (%)',
    defaultTarget: 75,
    sampleCriteria: (n) => `Maintain an overall average of ${n}%+ in submitted mock tests.`,
    actionHref: '/tests',
    actionLabel: 'Improve test score',
  },
  {
    type: 'watch_minutes',
    label: 'Auto-unlock: Study X Minutes of Lectures',
    unitLabel: 'Total study minutes',
    defaultTarget: 120,
    sampleCriteria: (n) => `Complete ${n} minutes of focused video lecture study.`,
    actionHref: '/lectures',
    actionLabel: 'Start studying',
  },
  {
    type: 'profile_complete',
    label: 'Auto-unlock: Welcome Onboarding Badge',
    unitLabel: '',
    defaultTarget: 1,
    sampleCriteria: () => 'Complete your JEE / NEET exam & class profile setup.',
    actionHref: '/profile',
    actionLabel: 'View profile',
  },
];

export function parseBadgeAutoRule(raw: BadgeAutoRule | string | null | undefined): BadgeAutoRule {
  if (!raw) return { type: 'manual', target: 0 };
  let parsed: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      const candidate = JSON.parse(raw);
      if (candidate && typeof candidate === 'object') parsed = candidate as Record<string, unknown>;
    } catch {
      return { type: 'manual', target: 0 };
    }
  } else if (typeof raw === 'object') {
    parsed = raw as unknown as Record<string, unknown>;
  }
  const match = BADGE_AUTO_RULE_OPTIONS.find((item) => item.type === parsed.type);
  if (!match) return { type: 'manual', target: 0 };
  if (match.type === 'manual') return { type: 'manual', target: 0 };
  if (match.type === 'profile_complete') return { type: 'profile_complete', target: 1 };
  const numeric = Number(parsed.target);
  const target = Number.isFinite(numeric) && numeric >= 1 ? Math.round(numeric) : match.defaultTarget;
  return { type: match.type, target };
}

export function describeBadgeCriteria(input: {
  criteria?: string;
  description?: string;
  auto_rule?: BadgeAutoRule | string | null;
}): string {
  const explicit = (input.criteria || '').trim();
  if (explicit) return explicit;
  const rule = parseBadgeAutoRule(input.auto_rule);
  if (rule.type !== 'manual') {
    const meta = BADGE_AUTO_RULE_OPTIONS.find((item) => item.type === rule.type);
    if (meta) return meta.sampleCriteria(rule.target);
  }
  return (input.description || '').trim() || 'Awarded by mentors for consistent preparation.';
}

export function rarityMeta(rarity: BadgeRarity | string | undefined) {
  switch (rarity) {
    case 'legendary':
      return {
        label: 'Legendary',
        cardClass: 'border-amber-300/90 bg-gradient-to-b from-amber-50/90 to-white',
        ringClass: 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-100 text-amber-700',
        pillClass: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    case 'epic':
      return {
        label: 'Epic',
        cardClass: 'border-violet-300/80 bg-gradient-to-b from-violet-50/80 to-white',
        ringClass: 'border-violet-300 bg-gradient-to-br from-violet-50 via-white to-fuchsia-100 text-violet-700',
        pillClass: 'bg-violet-100 text-violet-900 border-violet-300',
      };
    case 'rare':
      return {
        label: 'Rare',
        cardClass: 'border-sky-300/80 bg-gradient-to-b from-sky-50/80 to-white',
        ringClass: 'border-sky-300 bg-gradient-to-br from-sky-50 via-white to-cyan-100 text-sky-700',
        pillClass: 'bg-sky-100 text-sky-900 border-sky-300',
      };
    default:
      return {
        label: 'Standard',
        cardClass: 'border-ink-200 bg-[var(--ec-surface)]',
        ringClass: 'border-brand-200 bg-gradient-to-br from-brand-50 via-white to-indigo-50 text-brand-700',
        pillClass: 'bg-ink-100 text-ink-700 border-ink-200',
      };
  }
}

export function categoryLabel(category: BadgeCategory | string | undefined): string {
  switch (category) {
    case 'consistency':
      return 'Study Streak';
    case 'test_performance':
      return 'Mock Test Ranker';
    case 'course_completion':
      return 'Syllabus Milestone';
    case 'community':
      return 'Community Star';
    case 'verified':
      return 'Verified Scholar';
    case 'custom':
      return 'Special Honour';
    default:
      return 'Achievement';
  }
}

export function isSandboxHtmlBadgeCode(code: string): boolean {
  const trimmed = (code || '').trim();
  if (!trimmed) return false;
  return /<(canvas|script|svg|div|span|style)\b/i.test(trimmed);
}

/**
 * Safely scopes author-written CSS rules and @keyframes to a unique `[data-badge-scope="..."]`
 * selector so multiple custom-coded badges never collide and cannot leak styles outside the badge.
 */
export function compileScopedBadgeCss(rawCss: string, scopeId: string): string {
  const clean = (rawCss || '')
    .replace(/<\/style/gi, '')
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/expression\s*\(/gi, '')
    .trim();
  if (!clean) return '';

  const keyframeNames: string[] = [];
  let output = clean.replace(/@(-webkit-)?keyframes\s+([A-Za-z0-9_-]+)/g, (_full, prefix = '', name: string) => {
    keyframeNames.push(name);
    return `@${prefix || ''}keyframes ${scopeId}-${name}`;
  });

  for (const name of keyframeNames) {
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    output = output.replace(pattern, (matched, offset, str) => {
      const before = str.slice(Math.max(0, offset - 32), offset);
      if (before.endsWith(`${scopeId}-`)) return matched;
      return `${scopeId}-${matched}`;
    });
  }

  // Scope top-level selector blocks while leaving @keyframes blocks intact.
  const result: string[] = [];
  let i = 0;
  while (i < output.length) {
    const wsMatch = output.slice(i).match(/^\s+/);
    if (wsMatch) {
      result.push(wsMatch[0]);
      i += wsMatch[0].length;
      if (i >= output.length) break;
    }
    if (output.slice(i, i + 2) === '/*') {
      const endComment = output.indexOf('*/', i + 2);
      if (endComment === -1) break;
      i = endComment + 2;
      continue;
    }
    const openBrace = output.indexOf('{', i);
    if (openBrace === -1) break;
    const header = output.slice(i, openBrace).trim();
    let depth = 1;
    let cursor = openBrace + 1;
    while (cursor < output.length && depth > 0) {
      if (output[cursor] === '{') depth += 1;
      else if (output[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = output.slice(openBrace + 1, cursor - 1);
    if (/^@(-webkit-)?keyframes\b/i.test(header)) {
      result.push(`${header} {${body}}`);
    } else if (!header.startsWith('@')) {
      const scopedHeader = header
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((sel) => `[data-badge-scope="${scopeId}"] ${sel}`)
        .join(', ');
      if (scopedHeader) {
        result.push(`${scopedHeader} {${body}}`);
      }
    }
    i = cursor;
  }
  return result.join('\n');
}

export function buildBadgeSandboxDoc(rawCode: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8" />',
    '<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;display:grid;place-items:center}</style>',
    '</head><body>',
    rawCode,
    '</body></html>',
  ].join('');
}

/**
 * Resizes and compresses any uploaded badge image (PNG / JPEG / WebP / GIF) on the
 * client into a clean, lightweight <= 256×256 data URL ready for D1 persistence.
 */
export async function compressBadgeImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP or GIF).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image is larger than 8 MB. Choose a smaller image.');
  }
  if (file.type === 'image/gif' && file.size <= 180 * 1024) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.readAsDataURL(file);
    });
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode that image. Try PNG or JPG.'));
      el.src = bitmapUrl;
    });

    const maxSide = 256;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas image processing is unavailable in this browser.');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', 0.88);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/png');
    }
    if (dataUrl.length > 260000) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
