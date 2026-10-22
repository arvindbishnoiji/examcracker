'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import type { CourseCatalogItem } from '@/types';
import { DEFAULT_BATCH_STUDIO, buildAnimationDocument } from '@/lib/studio-config';
import { BatchShowcase } from '@/components/batches/BatchShowcase';
import { FeatureStrip } from '@/components/site/FeatureStrip';

/**
 * Internal storefront style guide (noindex).
 * Renders static sample data only — never student data — so the visual system,
 * colours and motion can be reviewed without signing in.
 */

function iso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

const SAMPLE_BATCHES: CourseCatalogItem[] = [
  {
    id: 'demo-jee-dropper',
    kind: 'batch',
    title: 'JEE 2027 Dropper — Rank Accelerator',
    description:
      'A 10-month guided programme: 120 concept lectures, 24 rank tests, a daily planner and mentor doubt sessions.',
    exam: 'JEE',
    classes: ['Dropper'],
    active: true,
    metadata: {
      thumbnailUrl: '',
      studio: {
        accent: 'violet',
        motion: 'zoom-in',
        badge: 'Flagship',
        subtitle: '120 lectures · 24 rank tests · daily planner',
        instructor: 'Er. A. B. Sharma',
        seats: 40,
        pages: ['home', 'lectures'],
        startsAt: iso(6),
        reward: { enabled: true, type: 'badge', label: 'Golden streak badge', value: '+250 XP', icon: '🏅' },
        features: [
          { id: 'f1', label: 'Daily planner', icon: '🗓️' },
          { id: 'f2', label: 'Doubt sessions', icon: '💬' },
          { id: 'f3', label: 'Weekly rank tests', icon: '📈' },
        ],
      },
    },
    created_at: iso(-10),
    updated_at: iso(-1),
  },
  {
    id: 'demo-neet-12',
    kind: 'batch',
    title: 'NEET 2027 Class 12 — Biology Beast',
    description: 'NCERT line-by-line, 4000+ MCQs, diagram drills and full-syllabus grand tests every fortnight.',
    exam: 'NEET',
    classes: ['12'],
    active: true,
    metadata: {
      studio: {
        accent: 'emerald',
        motion: 'float',
        badge: 'Topper’s pick',
        subtitle: 'NCERT mastery · 4000+ MCQs',
        instructor: 'Dr. Meera Singh',
        seats: 60,
        pages: ['home', 'lectures'],
        startsAt: iso(11),
        reward: { enabled: true, type: 'certificate', label: 'Completion certificate', value: '', icon: '📜' },
        features: [
          { id: 'f1', label: 'NCERT line-by-line', icon: '✓' },
          { id: 'f2', label: 'Diagram drills', icon: '🧠' },
        ],
      },
    },
    created_at: iso(-9),
    updated_at: iso(-2),
  },
  {
    id: 'demo-jee-11',
    kind: 'batch',
    title: 'JEE 2028 Class 11 — Foundation Sprint',
    description: 'Build the base early: mechanics, organic basics and maths with weekly micro-tests.',
    exam: 'JEE',
    classes: ['11'],
    active: true,
    metadata: {
      studio: {
        accent: 'sky',
        motion: 'fade-up',
        badge: 'New',
        subtitle: 'Early-bird foundation plan',
        instructor: 'S. Iyer',
        seats: 80,
        pages: ['home', 'lectures'],
        startsAt: iso(20),
        reward: { enabled: true, type: 'discount', label: '20% scholarship', value: 'SAVE20', icon: '🎟️' },
        features: [
          { id: 'f1', label: 'Weekly micro-tests', icon: '⚡' },
          { id: 'f2', label: 'Parent reports', icon: '📨' },
        ],
      },
    },
    created_at: iso(-8),
    updated_at: iso(-3),
  },
  {
    id: 'demo-crash',
    kind: 'batch',
    title: 'NEET Crash Course — 45 Day Sprint',
    description: 'Last-mile revision with 45 daily tests, high-yield notes and a final full mock.',
    exam: 'NEET',
    classes: ['12', 'Dropper'],
    active: true,
    metadata: {
      studio: {
        accent: 'amber',
        motion: 'shine',
        badge: 'Limited',
        subtitle: '45 days · 45 tests',
        instructor: 'Dr. Meera Singh',
        seats: 30,
        pages: ['home', 'lectures'],
        startsAt: iso(3),
        reward: { enabled: true, type: 'cash', label: 'Scholarship', value: '₹10,000', icon: '💰' },
        features: [
          { id: 'f1', label: '45 daily tests', icon: '🔥' },
          { id: 'f2', label: 'High-yield notes', icon: '📄' },
        ],
      },
    },
    created_at: iso(-7),
    updated_at: iso(-4),
  },
];

const DEMO_LAYER = {
  html: `<a class="sticker" href="#">
  <span class="badge">40% OFF</span>
  <span class="copy">Scholarship test<br><strong>Register free</strong></span>
  <span class="spark">✦</span>
</a>`,
  css: `*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:transparent}
.sticker{display:flex;align-items:center;gap:12px;text-decoration:none;padding:12px 16px;border-radius:18px;
color:#fff;background:linear-gradient(130deg,#0f766e,#0d9488 40%,#22c55e);
box-shadow:0 18px 40px rgba(13,148,136,.45);border:1px solid rgba(255,255,255,.25);animation:bob 3.4s ease-in-out infinite}
.badge{font-size:12px;font-weight:900;background:#facc15;color:#3f2d00;padding:6px 10px;border-radius:999px}
.copy{font-size:11.5px;line-height:1.35}.copy strong{font-size:14px}
@keyframes bob{50%{transform:translateY(-7px)}}`,
  js: `document.querySelector('.sticker').addEventListener('click',e=>e.preventDefault());`,
};

function DemoCornerLayer() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 1600);
    return () => window.clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-20 right-4 z-50 w-[268px]">
      <div className="relative rounded-[18px] shadow-2xl">
        <iframe
          title="Demo animation layer"
          srcDoc={buildAnimationDocument(DEMO_LAYER)}
          sandbox="allow-scripts allow-popups"
          className="h-24 w-full rounded-[18px] border-0"
        />
        <button
          type="button"
          onClick={() => setShow(false)}
          className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-white/40 bg-slate-900/80 text-xs text-white backdrop-blur"
          aria-label="Close demo layer"
        >
          ✕
        </button>
        <a
          href="/events"
          className="ec-anim-reward !bottom-2"
          style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
        >
          🎟️ Claim free seat
        </a>
      </div>
    </div>
  );
}

export default function DesignPreviewPage() {
  const [layout, setLayout] = useState<typeof DEFAULT_BATCH_STUDIO.layout>('spotlight');
  const config = { ...DEFAULT_BATCH_STUDIO, layout, pages: ['home' as const] };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
        <div className="ec-card p-4">
          <p className="ec-eyebrow-pill">
            <Sparkles size={12} /> Internal style guide
          </p>
          <h1 className="ec-display mt-2 text-[clamp(1.8rem,4vw,2.8rem)]">
            <span className="ec-gradient-text">Aurora 2026 — the new Exam Cracker look</span>
          </h1>
          <p className="ec-lead mt-2 max-w-2xl text-[0.95rem]">
            Bigger type, a distinct colour per feature, soft glass cards and real motion. This page renders sample data
            only, so you can review the design without signing in.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(['spotlight', 'tile', 'wide', 'minimal'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLayout(value)}
                className={`ec-btn px-3 py-1.5 text-[11px] font-bold capitalize ${
                  layout === value ? 'ec-btn-primary' : 'ec-btn-secondary'
                }`}
              >
                {value} layout
              </button>
            ))}
          </div>
        </div>

        <FeatureStrip />

        <BatchShowcase
          batches={SAMPLE_BATCHES}
          config={config}
          student={{ exam: 'JEE', classLevel: 'Dropper' }}
          page="home"
        />

        <div className="ec-card p-4">
          <p className="ec-eyebrow-pill">
            <Wand2 size={12} /> Animation Studio
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            After ~1.6 seconds a sandboxed corner layer appears with a claimable reward chip. It is authored entirely in
            the admin Animation Studio (HTML + CSS + JS) and rendered in an isolated iframe.
          </p>
        </div>

      <DemoCornerLayer />
    </div>
  );
}
