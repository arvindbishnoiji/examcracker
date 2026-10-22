'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { MotionPreset } from '@/types';

type RevealTag = 'div' | 'section' | 'article' | 'li' | 'header' | 'aside';

/**
 * Scroll-reveal wrapper. Content is rendered on the server exactly as before;
 * the animation is applied only after hydration so SEO/SSR text is never hidden
 * from crawlers or no-JS clients.
 */
export function Reveal({
  children,
  motion = 'fade-up',
  delay = 0,
  as = 'div',
  className = '',
  style,
  once = true,
}: {
  children: ReactNode;
  motion?: MotionPreset;
  delay?: number;
  as?: RevealTag;
  className?: string;
  style?: CSSProperties;
  once?: boolean;
}) {
  const Tag = as as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (motion === 'none' || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [motion, once]);

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={`ec-reveal ${className}`}
      data-motion={motion}
      data-visible={visible ? 'true' : 'false'}
      style={{ animationDelay: delay ? `${delay}ms` : undefined, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Staggered children helper — wraps each child in a delayed reveal. */
export function RevealGroup({
  children,
  motion = 'fade-up',
  step = 70,
  className = '',
}: {
  children: ReactNode[];
  motion?: MotionPreset;
  step?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <Reveal key={index} motion={motion} delay={index * step}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
