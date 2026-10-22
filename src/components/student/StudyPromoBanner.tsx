'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Flame, PlayCircle, Trophy } from 'lucide-react';

type StudyPromoBannerProps = {
  exam?: string | null;
  classLevel?: string | number | null;
  compact?: boolean;
};

const slides = [
  {
    eyebrow: 'YOUR PREPARATION, YOUR PACE',
    title: 'Your next big result starts today.',
    description: 'Build a steady study routine, one focused session at a time.',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1800&q=85',
    action: 'Explore batches',
    href: '/lectures?kind=batch',
    icon: BookOpen,
    tint: 'from-indigo-950/95 via-indigo-900/75 to-slate-900/10',
  },
  {
    eyebrow: 'PRACTICE WITH PURPOSE',
    title: 'Turn practice into progress.',
    description: 'Test what you know, spot weak areas, and come back stronger.',
    image: 'https://images.unsplash.com/photo-1453738773917-9c3eff1db985?auto=format&fit=crop&w=1800&q=85',
    action: 'Explore tests',
    href: '/tests',
    icon: Trophy,
    tint: 'from-sky-950/95 via-blue-900/75 to-slate-900/10',
  },
  {
    eyebrow: 'SMALL STEPS. BIG GOALS.',
    title: 'One chapter closer to your goal.',
    description: 'Keep your momentum going with lessons and revision.',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1800&q=85',
    action: 'Start learning',
    href: '/lectures',
    icon: PlayCircle,
    tint: 'from-violet-950/95 via-purple-900/75 to-slate-900/10',
  },
];

export function StudyPromoBanner({ exam, classLevel, compact = false }: StudyPromoBannerProps) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[active];
  const ActionIcon = slide.icon;
  const track = exam && classLevel ? `${exam} · Class ${classLevel}` : 'EXAM CRACKER · LEARN EVERY DAY';

  return (
    <section
      className={`relative isolate overflow-hidden rounded-[calc(var(--ec-radius)+6px)] bg-slate-950 text-white shadow-[var(--ec-shadow-lift)] ${compact ? 'min-h-[190px] sm:min-h-[210px]' : 'min-h-[230px] sm:min-h-[265px]'}`}
      aria-label="Featured study banners"
      aria-roledescription="carousel"
    >
      {slides.map((item, index) => (
        <div
          key={item.eyebrow}
          className={`absolute inset-0 transition-opacity duration-700 ${index === active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden={index !== active}
        >
          <img
            src={item.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading={index === 0 ? 'eager' : 'lazy'}
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${item.tint}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-slate-950/10" />
        </div>
      ))}

      <div className="relative z-10 flex min-h-[inherit] flex-col items-start justify-center p-5 sm:p-7 lg:p-9">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.15em] text-white/95 backdrop-blur-sm">
            <Flame size={11} /> {track.toUpperCase()}
          </span>
          <span className="text-[9px] font-bold tracking-[0.17em] text-white/70">{slide.eyebrow}</span>
        </div>
        <h2 className="max-w-2xl text-2xl font-black leading-[1.08] tracking-tight drop-shadow sm:text-3xl lg:text-4xl">
          {slide.title}
        </h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/85 sm:text-sm">{slide.description}</p>
        <Link
          href={slide.href}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ActionIcon size={15} /> {slide.action} <ArrowRight size={14} />
        </Link>
      </div>

      <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 sm:bottom-4 sm:right-6" role="group" aria-label="Choose featured banner">
        {slides.map((item, index) => (
          <button
            key={item.eyebrow}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`Show banner ${index + 1}: ${item.eyebrow.toLowerCase()}`}
            aria-pressed={active === index}
            className={`h-1.5 rounded-full transition-all ${active === index ? 'w-7 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/80'}`}
          />
        ))}
      </div>
    </section>
  );
}
