'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteSettingKey, SiteSettingRow, SiteConfig } from '@/types';
import {
  getAdminSiteSettings,
  publishAdminSiteSetting,
  resetAdminSiteSetting,
  saveAdminSiteSettingDraft,
} from '@/lib/api';
import { defaultForSetting, deepClone, mergeSiteConfig } from '@/lib/site-config';
import { validateSettingValue } from '@/lib/site-validation';
import { useSiteConfig } from '@/context/SiteConfigContext';
import { useToast } from '@/hooks/useToast';

export type SettingValue<K extends SiteSettingKey> = SiteConfig[K];

export interface SettingWorkspace<T extends object> {
  draft: T;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  resetting: boolean;
  error: string | null;
  validationErrors: string[];
  status: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  setDraft: (next: T | ((previous: T) => T)) => void;
  update: (patch: Partial<T>) => void;
  saveDraft: () => Promise<boolean>;
  publish: () => Promise<boolean>;
  reset: () => Promise<boolean>;
  reload: () => Promise<void>;
}

function mergePublished<T extends object>(key: SiteSettingKey, published: unknown): T {
  if (published && typeof published === 'object') {
    const merged = mergeSiteConfig({ [key]: published } as Partial<SiteConfig>);
    return merged[key] as T;
  }
  return defaultForSetting(key) as T;
}

function hasContent(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function useSettingWorkspace<K extends SiteSettingKey>(key: K): SettingWorkspace<SettingValue<K>> {
  const initial = defaultForSetting(key) as SettingValue<K>;
  const [draft, setDraftState] = useState<SettingValue<K>>(initial);
  const [baseline, setBaseline] = useState<SettingValue<K>>(initial);
  const [published, setPublished] = useState<SettingValue<K>>(initial);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const { refresh } = useSiteConfig();
  const { push } = useToast();
  const loadedRef = useRef(false);

  const hydrate = useCallback(
    (row: SiteSettingRow | undefined) => {
      const nextPublished = mergePublished<SettingValue<K>>(key, row?.published);
      const rawDraft = row?.draft;
      const nextDraft = hasContent(rawDraft)
        ? (mergeSiteConfig({ [key]: rawDraft } as Partial<SiteConfig>)[key] as SettingValue<K>)
        : deepClone(nextPublished);
      setPublished(nextPublished);
      setDraftState(nextDraft);
      setBaseline(deepClone(nextDraft));
      setPublishedAt(row?.published_at || null);
      setUpdatedAt(row?.updated_at || null);
    },
    [key]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getAdminSiteSettings();
      hydrate(rows.find((row) => row.key === key));
      setStatus(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load site settings. Apply the new Supabase migration and redeploy the Edge Function.'
      );
    } finally {
      setLoading(false);
    }
  }, [hydrate, key]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void reload();
  }, [reload]);

  const setDraft = useCallback((next: SettingValue<K> | ((previous: SettingValue<K>) => SettingValue<K>)) => {
    setDraftState((previous) => (typeof next === 'function' ? (next as (value: SettingValue<K>) => SettingValue<K>)(previous) : next));
    setStatus(null);
  }, []);

  const update = useCallback((patch: Partial<SettingValue<K>>) => {
    setDraftState((previous) => ({ ...previous, ...patch }));
    setStatus(null);
  }, []);

  const validate = useCallback((): boolean => {
    const result = validateSettingValue(key, draft);
    setValidationErrors(result.errors);
    if (!result.ok) {
      setError(null);
      push(`Fix ${result.errors.length} validation ${result.errors.length === 1 ? 'issue' : 'issues'} before saving.`, 'error');
      return false;
    }
    return true;
  }, [draft, key, push]);

  const saveDraftInternal = useCallback(
    async (value: SettingValue<K>): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const row = await saveAdminSiteSettingDraft(key, value);
        setBaseline(deepClone(value));
        setUpdatedAt(row.updated_at || new Date().toISOString());
        setStatus('Draft saved');
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save the draft.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [key]
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!validate()) return false;
    const ok = await saveDraftInternal(draft);
    if (ok) push('Draft saved. Students still see the previously published version.', 'success');
    return ok;
  }, [draft, push, saveDraftInternal, validate]);

  const publish = useCallback(async (): Promise<boolean> => {
    if (!validate()) return false;
    setPublishing(true);
    setError(null);
    try {
      // Always persist the exact current draft first. This makes the first
      // publish work even when nothing was edited yet (no row exists server-side)
      // and removes any draft/publish race after quick edits.
      const saved = await saveDraftInternal(draft);
      if (!saved) return false;
      const row = await publishAdminSiteSetting(key);
      setPublished(deepClone(draft));
      setPublishedAt(row.published_at || new Date().toISOString());
      setUpdatedAt(row.updated_at || new Date().toISOString());
      setStatus('Published to students');
      await refresh();
      push('Published. The student site now uses this configuration.', 'success');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish this configuration.');
      return false;
    } finally {
      setPublishing(false);
    }
  }, [draft, key, refresh, push, saveDraftInternal, validate]);

  const reset = useCallback(async (): Promise<boolean> => {
    setResetting(true);
    setError(null);
    try {
      await resetAdminSiteSetting(key);
      const defaults = defaultForSetting(key) as SettingValue<K>;
      setDraftState(defaults);
      setBaseline(deepClone(defaults));
      setPublished(deepClone(defaults));
      setPublishedAt(null);
      setValidationErrors([]);
      setStatus('Reset to defaults');
      await refresh();
      push('Reset to the built-in defaults.', 'success');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset this configuration.');
      return false;
    } finally {
      setResetting(false);
    }
  }, [key, push, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  return {
    draft,
    dirty,
    loading,
    saving,
    publishing,
    resetting,
    error,
    validationErrors,
    status,
    publishedAt,
    updatedAt,
    setDraft,
    update,
    saveDraft,
    publish,
    reset,
    reload,
  };
}
