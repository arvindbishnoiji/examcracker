'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Play } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export type YoutubeThumbnailProps = {
  src?: string | null;
  videoId?: string | null;
  alt: string;
  className?: string;
  fit?: 'contain' | 'cover';
  loading?: 'eager' | 'lazy';
  duration?: string | null;
  badge?: string | null;
  subjectName?: string | null;
  progressPercent?: number;
  completed?: boolean;
};

function sanitizeCandidateUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/\/vi\/default\//i.test(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/api/')) return null;
  return trimmed;
}

function getYoutubeFallbacks(videoId?: string | null): string[] {
  const id = (videoId || '').trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return [];
  const encoded = encodeURIComponent(id);
  const proxyBase = APP_CONFIG.cloudflare.mediaProxyUrl?.replace(/\/+$/, '');
  return [
    `https://i.ytimg.com/vi/${encoded}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${encoded}/mqdefault.jpg`,
    ...(proxyBase ? [`${proxyBase}/thumbnail?videoId=${encoded}`] : []),
    `https://i.ytimg.com/vi/${encoded}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${encoded}/mqdefault.jpg`,
  ];
}

export function buildYoutubeThumbnailCandidates(
  src?: string | null,
  videoId?: string | null
): string[] {
  const cleanSrc = sanitizeCandidateUrl(src);
  const list = [...(cleanSrc ? [cleanSrc] : []), ...getYoutubeFallbacks(videoId)];
  return list.filter((url, idx, all) => all.indexOf(url) === idx);
}

export default function YoutubeThumbnail({
  src,
  videoId,
  alt,
  className = 'aspect-video w-full',
  fit = 'contain',
  loading = 'lazy',
  duration,
  badge,
  subjectName,
  progressPercent = 0,
  completed = false,
}: YoutubeThumbnailProps) {
  const candidates = useMemo(() => buildYoutubeThumbnailCandidates(src, videoId), [src, videoId]);

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(candidates.length === 0);

  const candidateKey = candidates.join('|');
  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setFailed(candidates.length === 0);
  }, [candidateKey, candidates.length]);

  const activeUrl = !failed ? candidates[attempt] : undefined;
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progressPercent || 0)));

  const advanceFallback = () => {
    setLoaded(false);
    if (attempt + 1 < candidates.length) {
      setAttempt((value) => value + 1);
    } else {
      setFailed(true);
    }
  };

  return (
    <div
      className={`relative overflow-hidden bg-slate-900 select-none ${className}`}
      data-testid="lecture-thumbnail"
    >
      {!loaded && !failed && activeUrl && (
        <div
          aria-hidden
          className="absolute inset-0 ec-skeleton rounded-none opacity-80"
        />
      )}

      {!failed && activeUrl ? (
        <>
          {fit === 'contain' && (
            <img
              src={activeUrl}
              alt=""
              aria-hidden
              loading={loading}
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
            />
          )}
          <img
            src={activeUrl}
            alt={alt}
            loading={loading}
            onLoad={(event) => {
              const img = event.currentTarget;
              if (
                img.naturalWidth > 0 &&
                img.naturalWidth <= 120 &&
                attempt + 1 < candidates.length
              ) {
                advanceFallback();
                return;
              }
              setLoaded(true);
            }}
            onError={advanceFallback}
            className={`relative z-[1] h-full w-full transition-opacity duration-200 ${
              fit === 'cover' ? 'object-cover object-center' : 'object-contain object-center'
            } ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <div
          role="img"
          aria-label={alt || 'Lecture preview'}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-3 text-center text-white"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-blue-200">
            {videoId ? <Play size={16} className="translate-x-[1px]" /> : <BookOpen size={16} />}
          </span>
          {subjectName && (
            <span className="max-w-full truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-100">
              {subjectName}
            </span>
          )}
          <span className="line-clamp-1 max-w-[90%] text-[11px] font-medium text-slate-300">
            {alt || 'Course Media'}
          </span>
        </div>
      )}

      {(badge || subjectName) && (
        <div className="pointer-events-none absolute left-2 top-2 z-[2] flex max-w-[78%] items-center gap-1">
          {badge && (
            <span className="truncate rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              {badge}
            </span>
          )}
        </div>
      )}

      {completed && (
        <span
          title="Completed"
          className="pointer-events-none absolute right-2 top-2 z-[2] inline-flex items-center gap-1 rounded-md bg-emerald-600/95 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
        >
          <CheckCircle2 size={11} /> Done
        </span>
      )}

      {duration && (
        <span className="pointer-events-none absolute bottom-2 right-2 z-[2] rounded-md bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm">
          {duration}
        </span>
      )}

      {clampedProgress > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1 bg-black/45"
        >
          <div
            className={`h-full transition-all ${
              completed || clampedProgress >= 100 ? 'bg-emerald-400' : 'bg-blue-500'
            }`}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
