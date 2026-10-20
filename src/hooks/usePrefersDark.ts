'use client';

import { useEffect, useState } from 'react';

export function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(media.matches);
    const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    if (media.addEventListener) media.addEventListener('change', listener);
    else media.addListener(listener);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', listener);
      else media.removeListener(listener);
    };
  }, []);
  return prefersDark;
}
