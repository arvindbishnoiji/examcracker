'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SiteSettingRow } from '@/types';
import { getAdminSiteSettings } from '@/lib/api';
import { formatISTDateTime } from '@/lib/date';
import {
  SCREEN_DEFINITIONS,
  screenHref,
  type ScreenDefinition,
  type ScreenGroup,
} from '@/lib/screen-config';
import { AdminPageHeader, Banner, Panel, SearchInput, Spinner, StatusPill } from '../ui';

const GROUP_ORDER: ScreenGroup[] = ['Learning', 'Tests & progress', 'Communication', 'Discovery', 'Setup'];

export function ScreenStudio() {
  const [rows, setRows] = useState<SiteSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getAdminSiteSettings());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load screen settings. Check that the ec-site-api function is deployed.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SCREEN_DEFINITIONS;
    return SCREEN_DEFINITIONS.filter((screen) =>
      `${screen.label} ${screen.route} ${screen.description} ${screen.group}`.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    screens: filtered.filter((screen) => screen.group === group),
  })).filter((entry) => entry.screens.length > 0);

  const publishedCount = SCREEN_DEFINITIONS.filter((screen) => rowsByKey.get(screen.key)?.published).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Screen Studio"
        title="Student screens"
        description="Choose a student-facing screen and change its headings, labels, sections, layout and messages — no code required. Sign-in and sign-up are intentionally not editable here."
        meta={
          <>
            <StatusPill tone="brand">{SCREEN_DEFINITIONS.length} screens</StatusPill>
            <StatusPill tone={publishedCount ? 'success' : 'neutral'}>
              {publishedCount} with published changes
            </StatusPill>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="ec-btn border border-ink-200 px-3 py-2 text-xs font-semibold hover:bg-ink-50"
          >
            ⟳ Refresh status
          </button>
        }
      />

      {error ? (
        <Banner tone="danger" title="Could not read screen settings">
          <p>{error}</p>
          <p className="mt-1">
            Screens keep working with their built-in defaults. Deploy the updated <code>ec-site-api</code> function to
            manage them from here.
          </p>
        </Banner>
      ) : null}

      <div className="mt-4">
        <Panel
          title="How publishing works"
          description="Changes are safe by design."
          action={<SearchInput value={query} onChange={setQuery} placeholder="Find a screen…" />}
        >
          <ul className="grid gap-2 text-[11.5px] leading-relaxed text-ink-600 sm:grid-cols-3">
            <li className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <strong className="block text-ink-800">1. Edit a screen</strong>
              Drafts are private to you and do not change what students see.
            </li>
            <li className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <strong className="block text-ink-800">2. Save the draft</strong>
              Saving validates every field, including required headings and button links.
            </li>
            <li className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <strong className="block text-ink-800">3. Publish to students</strong>
              Only publishing changes the live screen. A failed publish is reported, never faked.
            </li>
          </ul>
        </Panel>
      </div>

      {loading ? (
        <Spinner label="Loading screen status…" />
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map((entry) => (
            <section key={entry.group}>
              <h2 className="ec-admin-label px-1">{entry.group}</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {entry.screens.map((screen) => (
                  <ScreenCard
                    key={screen.slug}
                    screen={screen}
                    row={rowsByKey.get(screen.key)}
                  />
                ))}
              </div>
            </section>
          ))}
          {grouped.length === 0 ? (
            <Panel title="No screens match">
              <p className="text-xs text-ink-500">Try a different word, or clear the search.</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="ec-btn mt-3 border border-ink-200 px-3 py-1.5 text-xs font-semibold"
              >
                Clear search
              </button>
            </Panel>
          ) : null}
        </div>
      )}

      <div className="mt-6">
        <Banner tone="info" title="Sign-in and sign-up are code-managed">
          Authentication screens stay outside this editor so the Firebase sign-in, Google sign-in, password reset and
          account creation flows cannot be broken by a configuration change.
        </Banner>
      </div>
    </div>
  );
}

function ScreenCard({ screen, row }: { screen: ScreenDefinition; row?: SiteSettingRow }) {
  const published = Boolean(row?.published);
  const hasDraft = Boolean(row?.draft);
  const draftDiffers = hasDraft && JSON.stringify(row?.draft) !== JSON.stringify(row?.published);
  const status = !published && !hasDraft
    ? { tone: 'neutral' as const, label: 'Built-in defaults' }
    : draftDiffers
      ? { tone: 'warning' as const, label: 'Unpublished draft' }
      : published
        ? { tone: 'success' as const, label: 'Published' }
        : { tone: 'info' as const, label: 'Draft saved' };

  return (
    <article className="ec-card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
            {screen.icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{screen.label}</h3>
            <p className="truncate text-[10.5px] text-ink-400">{screen.route}</p>
          </div>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>
      <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-ink-500">{screen.description}</p>
      <p className="mt-2 text-[10px] text-ink-400">
        {row?.published_at
          ? `Live since ${formatISTDateTime(row.published_at)}`
          : 'No published changes yet — students see the shipped design.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={screenHref(screen.slug)}
          className="ec-btn bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Edit screen
        </Link>
        <a
          href={screen.route.includes('[') ? screen.route.slice(0, screen.route.indexOf('/[')) : screen.route}
          target="_blank"
          rel="noopener noreferrer"
          className="ec-btn border border-ink-200 px-3 py-1.5 text-xs font-semibold hover:bg-ink-50"
        >
          View live ↗
        </a>
      </div>
    </article>
  );
}
