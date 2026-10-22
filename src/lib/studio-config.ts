/**
 * Experience Studio model
 * -----------------------
 * Two admin-authored experiences live here:
 *
 * 1. **Batch Studio** — presentation rules for featured programmes. The
 *    programmes themselves are real D1 `course_catalog` rows (kind=batch);
 *    each row may also carry a `studio` object in metadata with its own accent,
 *    motion preset, reward and page placement. `batchStudio` (a site setting)
 *    stores the global section rules and the colour cycle.
 * 2. **Animation Studio** — designer-authored HTML/CSS/JS layers that the
 *    storefront mounts inside a sandboxed iframe on a chosen page, for a chosen
 *    audience, trigger and time window.
 *
 * Everything is sanitised defensively: a stale or malformed published value can
 * never crash a student page.
 */

import type {
  AnimationFrequency,
  AnimationLayer,
  AnimationStudioConfig,
  AnimationSurface,
  AnimationTrigger,
  AudienceTarget,
  BatchAccent,
  BatchCardLayout,
  BatchFeature,
  BatchPage,
  BatchReward,
  BatchRewardType,
  BatchShowcaseConfig,
  MotionPreset,
} from '@/types';

export function studioId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${random}`;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown, fallback = '', max = 2000): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/* -------------------------------------------------------------------------- */
/* Palettes                                                                    */
/* -------------------------------------------------------------------------- */

export interface AccentPalette {
  id: Exclude<BatchAccent, 'auto'>;
  label: string;
  /** Deep gradient start. */
  from: string;
  /** Gradient end. */
  to: string;
  /** Soft tint used for chips and glows. */
  soft: string;
  /** Readable text colour on the soft tint. */
  ink: string;
  emoji: string;
}

export const BATCH_ACCENTS: AccentPalette[] = [
  { id: 'violet', label: 'Royal violet', from: '#7c3aed', to: '#c026d3', soft: '#f3e8ff', ink: '#5b21b6', emoji: '🟣' },
  { id: 'indigo', label: 'Deep indigo', from: '#4338ca', to: '#2563eb', soft: '#e0e7ff', ink: '#312e81', emoji: '🔵' },
  { id: 'sky', label: 'Sky pop', from: '#0284c7', to: '#06b6d4', soft: '#e0f2fe', ink: '#075985', emoji: '🩵' },
  { id: 'teal', label: 'Teal wave', from: '#0d9488', to: '#14b8a6', soft: '#ccfbf1', ink: '#115e59', emoji: '🟢' },
  { id: 'emerald', label: 'Emerald sprint', from: '#059669', to: '#84cc16', soft: '#dcfce7', ink: '#166534', emoji: '💚' },
  { id: 'amber', label: 'Amber gold', from: '#d97706', to: '#facc15', soft: '#fef3c7', ink: '#92400e', emoji: '🟡' },
  { id: 'orange', label: 'Sunset orange', from: '#ea580c', to: '#f97316', soft: '#ffedd5', ink: '#9a3412', emoji: '🟠' },
  { id: 'rose', label: 'Rose rush', from: '#e11d48', to: '#fb7185', soft: '#ffe4e6', ink: '#9f1239', emoji: '🔴' },
  { id: 'fuchsia', label: 'Fuchsia neon', from: '#c026d3', to: '#8b5cf6', soft: '#fae8ff', ink: '#86198f', emoji: '🩷' },
];

export const ACCENT_CYCLE: Exclude<BatchAccent, 'auto'>[] = BATCH_ACCENTS.map((accent) => accent.id);

export function accentPalette(accent: BatchAccent | string | undefined, seed = 0): AccentPalette {
  const id = String(accent || 'auto');
  if (id !== 'auto') {
    const match = BATCH_ACCENTS.find((entry) => entry.id === id);
    if (match) return match;
  }
  return BATCH_ACCENTS[Math.abs(seed) % BATCH_ACCENTS.length];
}

/* -------------------------------------------------------------------------- */
/* Labels + option lists                                                       */
/* -------------------------------------------------------------------------- */

export const BATCH_PAGE_LABELS: Record<BatchPage, string> = {
  home: 'Home dashboard',
  lectures: 'Lectures hub',
  tests: 'Tests & mocks',
  dashboard: 'Progress dashboard',
  events: 'Events calendar',
};

export const BATCH_PAGES: BatchPage[] = ['home', 'lectures', 'tests', 'dashboard', 'events'];

export const MOTION_PRESETS: Array<{ id: MotionPreset; label: string; hint: string }> = [
  { id: 'none', label: 'Static', hint: 'No movement — best for very low-end devices.' },
  { id: 'fade-up', label: 'Fade up', hint: 'Soft rise on appear. Safe everywhere.' },
  { id: 'slide-left', label: 'Slide in', hint: 'Enters from the right edge.' },
  { id: 'zoom-in', label: 'Zoom in', hint: 'Scales up with a spring ease.' },
  { id: 'blur-in', label: 'Blur in', hint: 'Sharpens into focus.' },
  { id: 'flip-in', label: 'Flip 3D', hint: 'A 3D card flip.' },
  { id: 'float', label: 'Float', hint: 'Gently floats while visible.' },
  { id: 'shine', label: 'Shine sweep', hint: 'Light sweeps across the card.' },
  { id: 'glow', label: 'Glow pulse', hint: 'Coloured halo pulses.' },
];

export const MOTION_PRESET_IDS: MotionPreset[] = MOTION_PRESETS.map((preset) => preset.id);

export const BATCH_LAYOUTS: Array<{ id: BatchCardLayout; label: string; hint: string }> = [
  { id: 'spotlight', label: 'Spotlight', hint: 'Big hero card with artwork. Best for your flagship batch.' },
  { id: 'tile', label: 'Tile grid', hint: 'Compact equal cards in a responsive grid.' },
  { id: 'wide', label: 'Wide banner', hint: 'Full-width horizontal card with side artwork.' },
  { id: 'minimal', label: 'Minimal', hint: 'Text-first card with a thin colour rail.' },
];

export const BATCH_LAYOUT_IDS: BatchCardLayout[] = BATCH_LAYOUTS.map((layout) => layout.id);

export const REWARD_TYPES: Array<{ id: BatchRewardType; label: string; icon: string; hint: string }> = [
  { id: 'none', label: 'No reward', icon: '—', hint: 'Do not show a reward block.' },
  { id: 'badge', label: 'Badge', icon: '🏅', hint: 'A collectible profile badge.' },
  { id: 'xp', label: 'XP points', icon: '⚡', hint: 'Progress points added on completion.' },
  { id: 'certificate', label: 'Certificate', icon: '📜', hint: 'A downloadable completion certificate.' },
  { id: 'discount', label: 'Discount', icon: '🎟️', hint: 'A coupon or fee waiver.' },
  { id: 'cash', label: 'Cash / scholarship', icon: '💰', hint: 'A scholarship or cash prize.' },
  { id: 'access', label: 'Bonus access', icon: '🔑', hint: 'Unlocks another batch or test series.' },
];

export const BATCH_REWARD_TYPES: BatchRewardType[] = REWARD_TYPES.map((reward) => reward.id);

export const AUDIENCE_LABELS: Record<AudienceTarget, string> = {
  all: 'All students',
  JEE: 'JEE',
  NEET: 'NEET',
  Dropper: 'Dropper',
  'JEE-11': 'JEE · Class 11',
  'JEE-12': 'JEE · Class 12',
  'JEE-Dropper': 'JEE · Dropper',
  'NEET-11': 'NEET · Class 11',
  'NEET-12': 'NEET · Class 12',
  'NEET-Dropper': 'NEET · Dropper',
};

export const AUDIENCE_IDS = Object.keys(AUDIENCE_LABELS) as AudienceTarget[];

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export const DEFAULT_BATCH_STUDIO: BatchShowcaseConfig = {
  enabled: true,
  eyebrow: 'Programmes built for your rank',
  title: 'Pick your batch. Own the syllabus.',
  subtitle:
    'Every batch ships with a day-wise plan, chapter lectures, rank-boosting tests and a reward you can actually claim.',
  layout: 'spotlight',
  showCountdown: true,
  showReward: true,
  showFeatures: true,
  showInstructor: true,
  showSeats: true,
  pages: ['home', 'lectures'],
  maxItems: 6,
  ctaLabel: 'Explore all batches',
  ctaHref: '/lectures',
  accentCycle: ['violet', 'sky', 'amber', 'emerald', 'rose', 'teal'],
};

export const DEFAULT_ANIMATION_STUDIO: AnimationStudioConfig = {
  enabled: true,
  respectReducedMotion: true,
  layers: [],
};

/* -------------------------------------------------------------------------- */
/* Animation templates                                                         */
/* -------------------------------------------------------------------------- */

export interface AnimationTemplate {
  id: string;
  name: string;
  description: string;
  surface: AnimationSurface;
  trigger: AnimationTrigger;
  caption: string;
  backdrop: AnimationLayer['backdrop'];
  html: string;
  css: string;
  js: string;
}

export const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  {
    id: 'confetti-claim',
    name: 'Confetti reward burst',
    description: 'Falling confetti with a reward card in the centre. Great for toppers or streak rewards.',
    surface: 'overlay',
    trigger: 'delay',
    caption: 'Streak reward unlocked',
    backdrop: 'dim',
    html: `<div class="burst">
  <div class="card">
    <div class="emoji">🎉</div>
    <p class="eyebrow">Reward unlocked</p>
    <h1>7-day streak bonus</h1>
    <p class="sub">You unlocked <strong>+250 XP</strong> and a golden streak badge.</p>
    <button class="claim">Claim reward</button>
  </div>
  <canvas id="fx"></canvas>
</div>`,
    css: `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif}
.burst{position:fixed;inset:0;display:grid;place-items:center}
canvas{position:fixed;inset:0;pointer-events:none}
.card{position:relative;z-index:2;width:min(360px,86vw);padding:26px 22px;border-radius:24px;
background:linear-gradient(160deg,#fff,#f5f3ff);box-shadow:0 30px 80px rgba(76,29,149,.35);
text-align:center;animation:pop .6s cubic-bezier(.2,1.4,.4,1) both;border:1px solid #ddd6fe}
.emoji{font-size:44px;animation:bob 2s ease-in-out infinite}
.eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7c3aed;font-weight:800;margin:6px 0 0}
h1{margin:6px 0 0;font-size:26px;line-height:1.15;color:#1e1b4b;letter-spacing:-.02em}
.sub{margin:8px 0 0;color:#5b21b6;font-size:13px;line-height:1.55}
.claim{margin-top:16px;width:100%;border:0;border-radius:14px;padding:13px 18px;font-weight:800;font-size:14px;
color:#fff;background:linear-gradient(120deg,#7c3aed,#c026d3);cursor:pointer;box-shadow:0 12px 30px rgba(124,58,237,.4)}
.claim:active{transform:scale(.98)}
@keyframes pop{from{opacity:0;transform:scale(.85) translateY(18px)}to{opacity:1;transform:none}}
@keyframes bob{50%{transform:translateY(-6px) rotate(-4deg)}}`,
    js: `const c=document.getElementById('fx');const x=c.getContext('2d');
function size(){c.width=innerWidth;c.height=innerHeight}size();addEventListener('resize',size);
const colors=['#7c3aed','#c026d3','#f59e0b','#06b6d4','#22c55e'];
const bits=Array.from({length:120},()=>({x:Math.random()*innerWidth,y:-Math.random()*innerHeight,
r:3+Math.random()*5,vy:1.4+Math.random()*2.6,vx:-.6+Math.random()*1.2,a:Math.random()*Math.PI,
va:-.08+Math.random()*.16,col:colors[Math.floor(Math.random()*colors.length)]}));
(function loop(){x.clearRect(0,0,c.width,c.height);
for(const b of bits){b.x+=b.vx;b.y+=b.vy;b.a+=b.va;if(b.y>innerHeight+20){b.y=-20;b.x=Math.random()*innerWidth}
x.save();x.translate(b.x,b.y);x.rotate(b.a);x.fillStyle=b.col;x.fillRect(-b.r,-b.r/2,b.r*2,b.r);x.restore()}
requestAnimationFrame(loop)})();
document.querySelector('.claim').onclick=function(){this.textContent='Claimed ✓';this.style.opacity=.7};`,
  },
  {
    id: 'marquee-ribbon',
    name: 'Scrolling announcement ribbon',
    description: 'A looped marquee ribbon pinned to the bottom — perfect for offers and schedule changes.',
    surface: 'banner',
    trigger: 'page_load',
    caption: 'Live notice',
    backdrop: 'none',
    html: `<div class="ribbon">
  <div class="tag">LIVE</div>
  <div class="track"><div class="run">
    <span>🚀 New crash course starts Monday</span><span>🎁 Use code CRACK20 for 20% off</span>
    <span>📅 Mock test #4 this Sunday 7 PM</span><span>🔥 Daily doubt session at 9 PM</span>
  </div><div class="run" aria-hidden="true">
    <span>🚀 New crash course starts Monday</span><span>🎁 Use code CRACK20 for 20% off</span>
    <span>📅 Mock test #4 this Sunday 7 PM</span><span>🔥 Daily doubt session at 9 PM</span>
  </div></div>
</div>`,
    css: `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:transparent}
.ribbon{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;overflow:hidden;
background:linear-gradient(120deg,#4c1d95,#7c3aed 45%,#c026d3);color:#fff;
box-shadow:0 14px 36px rgba(76,29,149,.45);border:1px solid rgba(255,255,255,.2)}
.tag{font-size:10px;font-weight:900;letter-spacing:.1em;background:#f59e0b;color:#3b2000;
padding:4px 9px;border-radius:999px;flex:none;animation:blink 1.6s ease-in-out infinite}
.track{overflow:hidden;flex:1;mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
.ribbon .track{display:flex}
.run{display:flex;gap:34px;white-space:nowrap;padding-right:34px;animation:slide 26s linear infinite}
.run span{font-size:13px;font-weight:700}
@keyframes slide{to{transform:translateX(-100%)}}
@keyframes blink{50%{opacity:.55}}`,
    js: ``,
  },
  {
    id: 'snow-focus',
    name: 'Snow / particle focus',
    description: 'Calm particle drift behind a focus message. Ideal for exam-week motivation.',
    surface: 'overlay',
    trigger: 'scroll',
    caption: 'Focus mode',
    backdrop: 'blur',
    html: `<div class="wrap"><canvas id="p"></canvas>
<div class="msg"><p class="tag">Focus mode</p><h2>One chapter. One hour. No phone.</h2>
<p>Small consistent blocks beat last-minute cramming. Start now.</p></div></div>`,
    css: `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;overflow:hidden}
.wrap{position:fixed;inset:0;background:radial-gradient(circle at 50% 20%,#1e1b4b,#0b1120 70%)}
canvas{position:absolute;inset:0}
.msg{position:relative;z-index:2;height:100%;display:grid;place-content:center;text-align:center;
padding:24px;color:#eef2ff;animation:rise .9s cubic-bezier(.2,1,.3,1) both}
.tag{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#a5b4fc;font-weight:800;margin:0}
h2{margin:8px 0 0;font-size:30px;letter-spacing:-.03em;line-height:1.15}
.msg p:last-child{margin:10px 0 0;color:#c7d2fe;font-size:14px}
@keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`,
    js: `const c=document.getElementById('p'),x=c.getContext('2d');
function size(){c.width=innerWidth;c.height=innerHeight}size();addEventListener('resize',size);
const dots=Array.from({length:90},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,
r:Math.random()*2+.6,s:Math.random()*.6+.2,o:Math.random()*.6+.2}));
(function loop(){x.clearRect(0,0,c.width,c.height);x.fillStyle='#c7d2fe';
for(const d of dots){d.y+=d.s;d.x+=Math.sin(d.y/50)*.3;if(d.y>innerHeight)d.y=-4;
x.globalAlpha=d.o;x.beginPath();x.arc(d.x,d.y,d.r,0,7);x.fill()}
requestAnimationFrame(loop)})();`,
  },
  {
    id: 'ribbon-offer',
    name: 'Corner offer sticker',
    description: 'A floating discount sticker in the corner with a claim link. Never blocks content.',
    surface: 'corner',
    trigger: 'delay',
    caption: 'Limited offer',
    backdrop: 'none',
    html: `<a class="sticker" href="#offer">
  <span class="badge">40% OFF</span>
  <span class="copy">Scholarship test<br><strong>Register free</strong></span>
  <span class="spark">✦</span>
</a>`,
    css: `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:transparent}
.sticker{display:flex;align-items:center;gap:12px;text-decoration:none;position:relative;
padding:12px 16px;border-radius:18px;color:#fff;overflow:hidden;
background:linear-gradient(130deg,#0f766e,#0d9488 40%,#22c55e);
box-shadow:0 18px 40px rgba(13,148,136,.45);border:1px solid rgba(255,255,255,.25);
animation:bob 3.4s ease-in-out infinite}
.badge{font-size:12px;font-weight:900;background:#facc15;color:#3f2d00;padding:6px 10px;border-radius:999px}
.copy{font-size:11.5px;line-height:1.35;letter-spacing:.01em}
.copy strong{font-size:14px}
.spark{position:absolute;right:8px;top:4px;font-size:12px;animation:twinkle 1.6s infinite}
@keyframes bob{50%{transform:translateY(-7px)}}
@keyframes twinkle{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`,
    js: `document.querySelector('.sticker').addEventListener('click',e=>{e.preventDefault();
document.querySelector('.sticker').animate([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:420})});`,
  },
  {
    id: 'countdown-launch',
    name: 'Countdown launch screen',
    description: 'Live countdown to the next test or batch launch. Auto-hides when the timer ends.',
    surface: 'banner',
    trigger: 'schedule',
    caption: 'Launching soon',
    backdrop: 'none',
    html: `<div class="bar"><span class="dot"></span>
<span class="label">Next mock test starts in</span>
<span class="timer" id="t">00:00:00</span>
<a class="go" href="#tests">Set reminder</a></div>`,
    css: `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif}
.bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:16px;
color:#fff;background:linear-gradient(120deg,#0f172a,#1e293b 60%,#334155);
border:1px solid rgba(148,163,184,.35);box-shadow:0 16px 36px rgba(15,23,42,.35)}
.dot{width:9px;height:9px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.2);animation:pulse 1.8s infinite}
.label{font-size:12px;color:#cbd5e1;font-weight:600}
.timer{font-variant-numeric:tabular-nums;font-weight:900;font-size:16px;letter-spacing:.06em;color:#fde68a}
.go{margin-left:auto;text-decoration:none;font-size:11.5px;font-weight:800;color:#0f172a;background:#fde68a;
padding:7px 12px;border-radius:999px}
@keyframes pulse{70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}}`,
    js: `const target=Date.now()+1000*60*60*26;const el=document.getElementById('t');
setInterval(()=>{let s=Math.max(0,Math.floor((target-Date.now())/1000));
const h=String(Math.floor(s/3600)).padStart(2,'0'),m=String(Math.floor(s%3600/60)).padStart(2,'0'),x=String(s%60).padStart(2,'0');
el.textContent=h+':'+m+':'+x},1000);`,
  },
  {
    id: 'spotlight-cursor',
    name: 'Spotlight cursor trail',
    description: 'A soft spotlight follows the pointer. Pure delight, zero content obstruction.',
    surface: 'floating',
    trigger: 'idle',
    caption: 'Ambient',
    backdrop: 'none',
    html: `<div id="glow"></div><div id="ring"></div>`,
    css: `*{box-sizing:border-box}body{margin:0;background:transparent;overflow:hidden;height:100vh}
#glow{position:fixed;width:340px;height:340px;border-radius:999px;pointer-events:none;
background:radial-gradient(circle,rgba(124,58,237,.32),transparent 65%);filter:blur(10px);
transform:translate(-50%,-50%);transition:opacity .4s}
#ring{position:fixed;width:18px;height:18px;border-radius:999px;border:2px solid rgba(192,38,211,.65);
transform:translate(-50%,-50%);pointer-events:none;transition:transform .12s ease-out}`,
    js: `const g=document.getElementById('glow'),r=document.getElementById('ring');
let x=innerWidth/2,y=innerHeight/2;
addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;r.style.left=x+'px';r.style.top=y+'px'});
(function loop(){g.style.left=x+'px';g.style.top=y+'px';requestAnimationFrame(loop)})();`,
  },
];

/* -------------------------------------------------------------------------- */
/* Sanitisation                                                                */
/* -------------------------------------------------------------------------- */

function sanitizeReward(value: unknown): BatchReward {
  const raw = isPlainRecord(value) ? value : {};
  return {
    enabled: bool(raw.enabled, false),
    type: oneOf(raw.type, BATCH_REWARD_TYPES, 'badge'),
    label: str(raw.label, '', 120),
    value: str(raw.value, '', 80),
    icon: str(raw.icon, '🏅', 8),
  };
}

function sanitizeFeatures(value: unknown): BatchFeature[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => isPlainRecord(entry))
    .map((entry) => ({
      id: str(entry.id, studioId('feat'), 60),
      label: str(entry.label, '', 120).trim(),
      icon: str(entry.icon, '✓', 8),
    }))
    .filter((entry) => entry.label.length > 0)
    .slice(0, 10);
}

export function sanitizeBatchStudio(value: unknown): BatchShowcaseConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_BATCH_STUDIO;
  const pages = Array.isArray(raw.pages)
    ? (raw.pages.filter((page) => BATCH_PAGES.includes(page as BatchPage)) as BatchPage[])
    : base.pages;
  const cycle = Array.isArray(raw.accentCycle)
    ? (raw.accentCycle.filter((accent) =>
        ACCENT_CYCLE.includes(accent as (typeof ACCENT_CYCLE)[number])
      ) as BatchShowcaseConfig['accentCycle'])
    : base.accentCycle;
  return {
    enabled: bool(raw.enabled, base.enabled),
    eyebrow: str(raw.eyebrow, base.eyebrow, 80),
    title: str(raw.title, base.title, 140),
    subtitle: str(raw.subtitle, base.subtitle, 400),
    layout: oneOf(raw.layout, BATCH_LAYOUT_IDS, base.layout),
    showCountdown: bool(raw.showCountdown, base.showCountdown),
    showReward: bool(raw.showReward, base.showReward),
    showFeatures: bool(raw.showFeatures, base.showFeatures),
    showInstructor: bool(raw.showInstructor, base.showInstructor),
    showSeats: bool(raw.showSeats, base.showSeats),
    pages: pages.length ? Array.from(new Set(pages)) : base.pages,
    maxItems: num(raw.maxItems, base.maxItems, 1, 12),
    ctaLabel: str(raw.ctaLabel, base.ctaLabel, 60),
    ctaHref: str(raw.ctaHref, base.ctaHref, 300),
    accentCycle: cycle.length ? cycle : base.accentCycle,
  };
}

function sanitizeAnimationLayer(value: unknown, index: number): AnimationLayer | null {
  const raw = isPlainRecord(value) ? value : {};
  const html = str(raw.html, '', 12000).trim();
  const css = str(raw.css, '', 12000);
  const js = str(raw.js, '', 12000);
  if (!html && !css && !js) return null;
  const pages = Array.isArray(raw.pages)
    ? (raw.pages.filter((page) => BATCH_PAGES.includes(page as BatchPage)) as BatchPage[])
    : ['home' as BatchPage];
  const rewardRaw = isPlainRecord(raw.reward) ? raw.reward : {};
  return {
    id: str(raw.id, `layer-${index + 1}`, 80) || `layer-${index + 1}`,
    name: str(raw.name, `Animation ${index + 1}`, 120) || `Animation ${index + 1}`,
    enabled: bool(raw.enabled, true),
    surface: oneOf<AnimationSurface>(raw.surface, ['overlay', 'banner', 'corner', 'floating'], 'overlay'),
    pages: pages.length ? Array.from(new Set(pages)) : ['home'],
    audience: oneOf<AudienceTarget>(raw.audience, AUDIENCE_IDS, 'all'),
    trigger: oneOf<AnimationTrigger>(
      raw.trigger,
      ['page_load', 'delay', 'scroll', 'exit_intent', 'idle', 'schedule'],
      'page_load'
    ),
    delayMs: num(raw.delayMs, 900, 0, 120000),
    durationMs: num(raw.durationMs, 0, 0, 600000),
    frequency: oneOf<AnimationFrequency>(
      raw.frequency,
      ['always', 'once_session', 'once_day', 'once_user'],
      'once_session'
    ),
    caption: str(raw.caption, '', 120),
    html,
    css,
    js,
    backdrop: oneOf(raw.backdrop, ['none', 'dim', 'blur', 'vignette'], 'none'),
    dismissible: bool(raw.dismissible, true),
    reward: {
      label: str(rewardRaw.label, '', 120),
      icon: str(rewardRaw.icon, '🎁', 8),
      href: str(rewardRaw.href, '', 300),
      claimLabel: str(rewardRaw.claimLabel, '', 40),
    },
    startAt: str(raw.startAt, '', 40),
    endAt: str(raw.endAt, '', 40),
    priority: num(raw.priority, 0, -100, 100),
    updatedAt: str(raw.updatedAt, '', 40),
  };
}

export function sanitizeAnimations(value: unknown): AnimationStudioConfig {
  const raw = isPlainRecord(value) ? value : {};
  const base = DEFAULT_ANIMATION_STUDIO;
  const layers = Array.isArray(raw.layers)
    ? raw.layers
        .map((layer, index) => sanitizeAnimationLayer(layer, index))
        .filter((layer): layer is AnimationLayer => Boolean(layer))
        .slice(0, 12)
    : [];
  return {
    enabled: bool(raw.enabled, base.enabled),
    respectReducedMotion: bool(raw.respectReducedMotion, base.respectReducedMotion),
    layers,
  };
}

/* -------------------------------------------------------------------------- */
/* Runtime helpers                                                             */
/* -------------------------------------------------------------------------- */

export function batchPageEnabled(config: BatchShowcaseConfig, page: BatchPage): boolean {
  return config.enabled && config.pages.includes(page);
}

function parseTime(value: string): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function layerActiveNow(layer: AnimationLayer, now = Date.now()): boolean {
  const start = parseTime(layer.startAt);
  const end = parseTime(layer.endAt);
  if (start !== null && now < start) return false;
  if (end !== null && now > end) return false;
  return true;
}

export interface StudentAudienceLike {
  exam?: string | null;
  classLevel?: string | null;
}

export function audienceMatchesTarget(audience: AudienceTarget, student: StudentAudienceLike | null): boolean {
  if (audience === 'all') return true;
  if (!student) return false;
  const exam = String(student.exam || '');
  const cls = String(student.classLevel || '');
  if (audience === 'JEE' || audience === 'NEET') return exam === audience;
  if (audience === 'Dropper') return cls === 'Dropper';
  const [targetExam, targetClass] = audience.split('-');
  return exam === targetExam && cls === targetClass;
}

/** Layers eligible for a page, ordered by priority (already time-checked). */
export function layersForPage(
  config: AnimationStudioConfig,
  page: BatchPage,
  student: StudentAudienceLike | null,
  now = Date.now()
): AnimationLayer[] {
  if (!config.enabled) return [];
  return config.layers
    .filter((layer) => layer.enabled && layer.pages.includes(page))
    .filter((layer) => audienceMatchesTarget(layer.audience, student))
    .filter((layer) => layerActiveNow(layer, now))
    .sort((a, b) => b.priority - a.priority);
}

/** Display-only view of a batch's studio metadata. */
export interface BatchLook {
  accent: BatchAccent;
  motion: MotionPreset;
  badge: string;
  imageUrl: string;
  heroImageUrl: string;
  instructor: string;
  features: BatchFeature[];
  reward: BatchReward;
  pages: BatchPage[];
  startsAt: string;
  endsAt: string;
  seats: number;
  ctaLabel: string;
  ctaHref: string;
  priority: number;
  subtitle: string;
}

export function readBatchLook(
  metadata: Record<string, unknown> | null | undefined,
  seed = 0
): BatchLook {
  const meta = isPlainRecord(metadata) ? metadata : {};
  const studio = isPlainRecord(meta.studio) ? meta.studio : {};
  const pick = (key: string): unknown => studio[key] ?? meta[key];
  const pagesRaw = pick('pages');
  const pages = Array.isArray(pagesRaw)
    ? (pagesRaw.filter((page) => BATCH_PAGES.includes(page as BatchPage)) as BatchPage[])
    : [];
  return {
    accent: oneOf<BatchAccent>(pick('accent'), ['auto', ...ACCENT_CYCLE] as BatchAccent[], 'auto'),
    motion: oneOf<MotionPreset>(pick('motion'), MOTION_PRESET_IDS, 'fade-up'),
    badge: str(pick('badge'), '', 40),
    imageUrl: str(pick('imageUrl') || meta.thumbnailUrl || meta.thumbnail_url, '', 1000),
    heroImageUrl: str(pick('heroImageUrl'), '', 1000),
    instructor: str(pick('instructor'), '', 120),
    features: sanitizeFeatures(pick('features')),
    reward: sanitizeReward(pick('reward')),
    pages,
    startsAt: str(pick('startsAt') || meta.starts_at, '', 40),
    endsAt: str(pick('endsAt') || meta.ends_at, '', 40),
    seats: num(pick('seats'), 0, 0, 100000),
    ctaLabel: str(pick('ctaLabel'), '', 60),
    ctaHref: str(pick('ctaHref') || meta.deepLink, '', 300),
    priority: num(pick('priority'), 0, -100, 100),
    subtitle: str(pick('subtitle'), '', 180),
  };
}

const ANIMATION_BASE_CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; font-family: Inter, "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif; background: transparent; }
  body { display: grid; place-items: center; }
  a { color: inherit; }
`;

/**
 * Composes the sandboxed document used by the storefront host and the admin
 * preview. The layer always runs in its own origin, so authored JS cannot reach
 * the app, its storage or student data.
 */
export function buildAnimationDocument(layer: {
  html: string;
  css: string;
  js: string;
}): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<style>${ANIMATION_BASE_CSS}</style>`,
    `<style>${layer.css}</style>`,
    '</head><body>',
    layer.html,
    `<script>try{${layer.js}}catch(error){console.error('[Exam Cracker animation]', error)}</` + 'script>',
    '</body></html>',
  ].join('');
}
