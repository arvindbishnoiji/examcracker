'use client';

import { useState } from 'react';
import { APP_CONFIG } from '@/lib/config';

type YoutubeThumbnailProps = {
  src?: string | null;
  videoId?: string | null;
  alt: string;
  className: string;
  loading?: 'eager' | 'lazy';
};

function getFallbacks(videoId?: string | null): string[] {
  const id = (videoId || '').trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return [];
  const encoded = encodeURIComponent(id);
  return [
    `${APP_CONFIG.cloudflare.mediaProxyUrl}/thumbnail?videoId=${encoded}`,
    `https://i.ytimg.com/vi/${encoded}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${encoded}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${encoded}/sddefault.jpg`,
    `https://img.youtube.com/vi/${encoded}/0.jpg`,
  ];
}

export default function YoutubeThumbnail({
  src,
  videoId,
  alt,
  className,
  loading = 'lazy',
}: YoutubeThumbnailProps) {
  const candidates = [
    ...(src ? [src] : []),
    ...getFallbacks(videoId),
  ].filter((url, index, all) => all.indexOf(url) === index);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(candidates.length === 0);

  if (failed || !candidates[attempt]) {
    return (
      <div
        role="img"
        aria-label={`Thumbnail unavailable: ${alt}`}
        className={`${className} grid place-items-center text-xs text-ink-400`}
      >
        Thumbnail unavailable
      </div>
    );
  }

  return (
    <img
      src={candidates[attempt]}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (attempt + 1 < candidates.length) setAttempt((value) => value + 1);
        else setFailed(true);
      }}
    />
  );
}
