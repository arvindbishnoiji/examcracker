'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchAuthorizedBlob } from '@/lib/api';

function initialsOf(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || 'S';
}

/**
 * Read-only profile image for lists and headers.
 *
 * Drive files are private, so the bytes are fetched with the Firebase bearer
 * token and rendered from an object URL. Falls back to initials when the student
 * has no photo or the request fails.
 */
export function ProfileImage({
  src,
  name,
  className = 'h-10 w-10',
  textClassName = 'text-xs',
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setObjectUrl(null);
    if (!src) return () => { cancelled = true; };

    fetchAuthorizedBlob(src)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setObjectUrl(url);
      })
      .catch(() => {
        // Fall back to initials rather than showing a broken image icon.
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  if (objectUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={objectUrl} alt={name || 'Student'} className={`shrink-0 rounded-full object-cover ${className}`} />
    );
  }

  return (
    <span aria-label={name || 'Student'} className={`ec-avatar shrink-0 ${textClassName} ${className}`} role="img">
      {initialsOf(name || '')}
    </span>
  );
}
