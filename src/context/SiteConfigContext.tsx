'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  FeatureFlags,
  PublicSiteConfig,
  SeoConfig,
  SiteConfig,
  SiteSettingKey,
  ThemeConfig,
} from '@/types';
import { getPublicSiteConfig } from '@/lib/api';
import { DEFAULT_SITE_CONFIG, mergeSiteConfig } from '@/lib/site-config';
import { applyThemeToElement, ensureThemeFonts } from '@/lib/theme';

interface SiteConfigState {
  config: SiteConfig;
  publishedAt: Partial<Record<SiteSettingKey, string>>;
  loading: boolean;
  error: string | null;
  degraded: boolean;
  refresh: () => Promise<void>;
}

const SiteConfigContext = createContext<SiteConfigState | null>(null);

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (!content) return;
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function applySeo(seo: SeoConfig, theme: ThemeConfig): void {
  if (typeof document === 'undefined') return;
  document.title = seo.title || theme.brandName;
  upsertMeta('name', 'description', seo.description);
  if (seo.keywords.length) upsertMeta('name', 'keywords', seo.keywords.join(', '));
  upsertMeta('property', 'og:title', seo.title);
  upsertMeta('property', 'og:description', seo.description);
  if (seo.ogImageUrl) upsertMeta('property', 'og:image', seo.ogImageUrl);
  upsertMeta('name', 'twitter:card', seo.ogImageUrl ? 'summary_large_image' : 'summary');
  if (seo.twitterHandle) upsertMeta('name', 'twitter:site', seo.twitterHandle);
  upsertMeta('name', 'robots', seo.robotsIndex ? 'index,follow' : 'noindex,nofollow');

  const favicon = theme.faviconUrl || '/favicon.ico';
  let icon = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  if (icon.getAttribute('href') !== favicon) icon.setAttribute('href', favicon);
}

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(() => mergeSiteConfig());
  const [publishedAt, setPublishedAt] = useState<Partial<Record<SiteSettingKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await getPublicSiteConfig();
      if (!mounted.current) return;
      const partial = (response?.config || {}) as PublicSiteConfig;
      setConfig(mergeSiteConfig(partial));
      setPublishedAt(response?.publishedAt || {});
      setDegraded(Boolean(response?.degraded));
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the published site configuration. Showing the last known defaults.'
      );
      setConfig((current) => current || mergeSiteConfig());
      setDegraded(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    ensureThemeFonts();
    applyThemeToElement(document.documentElement, config.theme, prefersDark);
    applySeo(config.seo, config.theme);
  }, [config.theme, config.seo, prefersDark]);

  const value = useMemo<SiteConfigState>(
    () => ({ config, publishedAt, loading, error, degraded, refresh }),
    [config, publishedAt, loading, error, degraded, refresh]
  );

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfigState {
  const context = useContext(SiteConfigContext);
  if (!context) {
    return {
      config: DEFAULT_SITE_CONFIG,
      publishedAt: {},
      loading: false,
      error: null,
      degraded: false,
      refresh: async () => {},
    };
  }
  return context;
}

export function useFeatureFlags(): FeatureFlags {
  return useSiteConfig().config.features;
}

export function useThemeConfig(): ThemeConfig {
  return useSiteConfig().config.theme;
}

export function useSeoConfig(): SeoConfig {
  return useSiteConfig().config.seo;
}
