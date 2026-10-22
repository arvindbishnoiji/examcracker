// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import YoutubeThumbnail, { buildYoutubeThumbnailCandidates } from '../components/YoutubeThumbnail';
import { BannerArtwork } from '../components/banners/BannerArtwork';
import { BannerCarousel } from '../components/banners/BannerCarousel';
import { ConfirmDialog, Modal } from '../components/admin/ui';
import { EmptyState } from '../components/ui/Card';
import { ScreenPreview } from '../components/admin/screens/ScreenPreview';
import { DEFAULT_SCREEN_CONFIGS } from '../lib/screen-config';
import { selectBannersForPlacement } from '../lib/site-config';
import { resolveRouteGate } from '../lib/auth-gate';
import { formatClassLevel, formatClassList, inheritChildAudience } from '../lib/validation';
import type { Banner, BannersConfig } from '../types';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...rest }, children),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let mountedContainers: Array<{ container: HTMLDivElement; unmount: () => void }> = [];

function mount(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  const unmount = () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
  mountedContainers.push({ container, unmount });
  return {
    container,
    rerender: (next: React.ReactElement) => {
      act(() => {
        root.render(next);
      });
    },
  };
}

afterEach(() => {
  for (const entry of mountedContainers) entry.unmount();
  mountedContainers = [];
});

describe('Scenario 9: Accessible Modal & ConfirmDialog open/close/Escape/loading-lock & form inheritance', () => {
  it('renders dialog semantics, closes on Escape & Close button, and locks body scroll while open', () => {
    const onClose = vi.fn();
    const { container, rerender } = mount(
      <Modal open={false} onClose={onClose} title="Add Lecture">
        <p>Form fields</p>
      </Modal>
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    rerender(
      <Modal open={true} onClose={onClose} title="Add Lecture" description="Link to subject queue">
        <input aria-label="Lecture Title" defaultValue="" />
      </Modal>
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = container.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <Modal open={false} onClose={onClose} title="Add Lecture">
        <p>Form fields</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('prevents duplicate submissions in ConfirmDialog when loading=true and formats Dropper labels cleanly', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = mount(
      <ConfirmDialog
        open={true}
        loading={true}
        title="Delete lecture?"
        description="Permanent deletion check"
        confirmLabel="Delete permanently"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const confirmBtn = buttons.find((b) => b.textContent?.includes('Working')) as HTMLButtonElement;
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.disabled).toBe(true);
    act(() => {
      confirmBtn.click();
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Parent/subject inheritance helper used by Add Lecture & Playlist modals
    expect(
      inheritChildAudience(
        { exam: 'NEET', classes: ['11', '12', 'Dropper'] },
        { exam: 'NEET', classes: ['Dropper'] }
      )
    ).toEqual({ exam: 'NEET', classes: ['Dropper'] });
    expect(formatClassLevel('Dropper')).toBe('Dropper');
    expect(formatClassLevel('11')).toBe('Class 11');
    expect(formatClassList(['11', '12', 'Dropper'])).toBe('Class 11, Class 12, Dropper');
  });
});

describe('Scenario 11: Banner audience filtering (JEE/NEET/Dropper/All), deduplication & fallback rendering', () => {
  const sampleBanner = (overrides: Partial<Banner>): Banner => ({
    id: 'b-1',
    title: 'JEE Rank Booster',
    subtitle: 'Full syllabus revision',
    description: 'Structured daily problem practice',
    badge: 'LIVE',
    desktopImageUrl: 'https://cdn.example.com/banner.jpg',
    mobileImageUrl: '',
    backgroundColor: '#1d4ed8',
    overlay: 45,
    textAlign: 'left',
    ctaLabel: 'Explore Batch',
    ctaHref: '/lectures',
    placements: ['dashboard', 'lectures'],
    audience: 'JEE',
    startAt: '',
    endAt: '',
    timezone: 'Asia/Kolkata',
    status: 'published',
    priority: 10,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  });

  it('filters banners accurately across JEE, NEET, Class 11, Class 12, and Dropper cohorts', () => {
    const config: BannersConfig = {
      autoplay: true,
      rotationSeconds: 6,
      showArrows: true,
      showDots: true,
      items: [
        sampleBanner({ id: 'b-all', audience: 'all', priority: 1 }),
        sampleBanner({ id: 'b-jee', audience: 'JEE', priority: 2 }),
        sampleBanner({ id: 'b-neet', audience: 'NEET', priority: 3 }),
        sampleBanner({ id: 'b-drop', audience: 'Dropper', priority: 4 }),
        sampleBanner({ id: 'b-jee-drop', audience: 'JEE-Dropper', priority: 5 }),
        sampleBanner({ id: 'b-jee-11', audience: 'JEE-11', priority: 6 }),
        sampleBanner({ id: 'b-inactive', audience: 'all', status: 'paused' }),
      ],
    };

    const jeeDropperMatches = selectBannersForPlacement(
      config,
      { exam: 'JEE', class_level: 'Dropper' },
      'dashboard'
    ).map((b) => b.id);
    // Dropper matches all, JEE, Dropper, JEE-Dropper, AND JEE-11
    expect(jeeDropperMatches).toEqual(['b-jee-11', 'b-jee-drop', 'b-drop', 'b-jee', 'b-all']);
    expect(jeeDropperMatches).not.toContain('b-neet');
    expect(jeeDropperMatches).not.toContain('b-inactive');

    const neet12Matches = selectBannersForPlacement(
      config,
      { exam: 'NEET', class_level: '12' },
      'dashboard'
    ).map((b) => b.id);
    expect(neet12Matches).toEqual(['b-neet', 'b-all']);
  });

  it('deduplicates repeated banner IDs, hides carousel arrows for a single slide, and falls back gracefully on image error', () => {
    const dup = sampleBanner({ id: 'dup-1', title: 'Unique Academic Banner' });
    const { container } = mount(<BannerCarousel banners={[dup, dup]} />);
    expect(container.textContent).toContain('Unique Academic Banner');
    // Single unique banner -> no Next/Previous slide buttons
    expect(container.querySelector('button[aria-label="Next banner"]')).toBeNull();

    // Image error falls back cleanly without broken image icon remaining mounted
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    act(() => {
      img.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();
    // Title & CTA remain readable over gradient fallback
    expect(container.textContent).toContain('Unique Academic Banner');
    expect(container.textContent).toContain('Explore Batch');

    // Empty banner list renders nothing
    expect(renderToString(<BannerCarousel banners={[]} />)).toBe('');

    // BannerArtwork with empty image URL renders clean gradient directly
    const noImageHtml = renderToString(
      <BannerArtwork banner={sampleBanner({ desktopImageUrl: '', mobileImageUrl: '' })} />
    );
    expect(noImageHtml).not.toContain('<img');
  });
});

describe('Scenario 12: 16:9 YoutubeThumbnail non-cutoff framing & fallback behavior', () => {
  it('excludes /vi/default/ placeholder URLs and renders 16:9 non-cutoff contain framing with progress/duration overlays', () => {
    const candidates = buildYoutubeThumbnailCandidates(
      'https://i.ytimg.com/vi/default/hqdefault.jpg',
      'dQw4w9WgXcQ'
    );
    expect(candidates.some((url) => url.includes('/vi/default/'))).toBe(false);
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    const { container } = mount(
      <YoutubeThumbnail
        videoId="dQw4w9WgXcQ"
        alt="Rotational Mechanics 01"
        duration="54:20"
        progressPercent={65}
      />
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('aspect-video');
    const mainImg = Array.from(container.querySelectorAll('img')).find((el) => el.alt === 'Rotational Mechanics 01')!;
    expect(mainImg.className).toContain('object-contain');
    expect(container.textContent).toContain('54:20');

    // Simulate all candidate URLs failing -> renders structured academic fallback
    for (let i = 0; i < candidates.length + 1; i++) {
      const currentImg = Array.from(container.querySelectorAll('img')).find(
        (el) => el.alt === 'Rotational Mechanics 01'
      );
      if (!currentImg) break;
      act(() => {
        currentImg.dispatchEvent(new Event('error'));
      });
    }
    expect(container.textContent).toContain('Rotational Mechanics 01');
  });
});

describe('Scenarios 13 & 14: Auth-protected route gate, EmptyState & Dropper onboarding preview', () => {
  it('redirects unauthenticated users to /login, un-onboarded users to /onboarding, and preserves retry state on bootstrap error', () => {
    expect(
      resolveRouteGate({
        pathname: '/lectures/lec-1',
        initializing: false,
        signedIn: false,
        hasProfile: false,
        bootstrapError: null,
        bootstrapLoading: false,
      })
    ).toEqual({ state: 'redirect', to: '/login' });

    expect(
      resolveRouteGate({
        pathname: '/home',
        initializing: false,
        signedIn: true,
        hasProfile: false,
        bootstrapError: null,
        bootstrapLoading: false,
      })
    ).toEqual({ state: 'redirect', to: '/onboarding' });

    expect(
      resolveRouteGate({
        pathname: '/home',
        initializing: false,
        signedIn: true,
        hasProfile: false,
        bootstrapError: 'Network timeout',
        bootstrapLoading: false,
      })
    ).toEqual({ state: 'error', message: 'Network timeout' });
  });

  it('renders structured EmptyState and Dropper option in onboarding ScreenPreview', () => {
    const emptyHtml = renderToString(
      <EmptyState
        title="No more lectures in Physics"
        description="You have reached the end of this subject queue."
      />
    );
    expect(emptyHtml).toContain('No more lectures in Physics');
    expect(emptyHtml).toContain('You have reached the end of this subject queue.');

    const onboardingHtml = renderToString(
      <ScreenPreview screenKey="onboarding" config={DEFAULT_SCREEN_CONFIGS.onboarding} />
    );
    expect(onboardingHtml).toContain('Class 11');
    expect(onboardingHtml).toContain('Class 12');
    expect(onboardingHtml).toContain('Dropper');
  });
});
