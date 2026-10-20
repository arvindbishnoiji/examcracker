'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppearanceSection } from '@/components/admin/sections/AppearanceSection';
import { BannersSection } from '@/components/admin/sections/BannersSection';
import { ContentToolSection } from '@/components/admin/sections/ContentSections';
import {
  AnalyticsSection,
  CampaignsSection,
  HealthSection,
  LeaderboardsSection,
  ReportsSection,
  SchedulingSection,
  StudentsSection,
} from '@/components/admin/sections/DataSections';
import { HomepageBuilderSection } from '@/components/admin/sections/HomepageBuilderSection';
import { LoginDesignerSection } from '@/components/admin/sections/LoginDesignerSection';
import { NotificationsSection } from '@/components/admin/sections/NotificationsSection';
import { PopupsSection } from '@/components/admin/sections/PopupsSection';
import {
  ChallengesSection,
  FeaturesSection,
  FooterSection,
  MediaSection,
  NavigationSection,
  SearchSeoSection,
} from '@/components/admin/sections/SettingsSections';
import { ImportExportSection, PreferencesSection } from '@/components/admin/sections/SystemSections';
import { TestimonialsSection } from '@/components/admin/sections/TestimonialsSection';
import AdminLegacyPanel from '@/app/admin/_legacy/AdminLegacyPanel';
import { findAdminSection } from '@/lib/admin-sections';

const CONTENT_TABS = ['goals', 'batches', 'series', 'lectures', 'tests', 'events', 'announcements'] as const;
type ContentTab = (typeof CONTENT_TABS)[number];

function isContentTab(slug: string): slug is ContentTab {
  return (CONTENT_TABS as readonly string[]).includes(slug);
}

export default function AdminSectionPage() {
  const params = useParams<{ section: string }>();
  const slug = typeof params?.section === 'string' ? params.section : '';
  const meta = findAdminSection(slug);

  if (!meta) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <p className="text-4xl">🧭</p>
        <h1 className="text-xl font-bold mt-3">Section not found</h1>
        <p className="text-sm text-ink-500 mt-1">“{slug}” is not part of the admin console.</p>
        <Link href="/admin" className="mt-5 inline-flex px-4 py-2 rounded-[var(--ec-button-radius)] bg-ink-900 text-white text-sm font-semibold">
          Back to overview
        </Link>
      </div>
    );
  }

  switch (slug) {
    case 'appearance':
      return <AppearanceSection />;
    case 'login':
      return <LoginDesignerSection />;
    case 'homepage':
      return <HomepageBuilderSection />;
    case 'banners':
      return <BannersSection />;
    case 'popups':
      return <PopupsSection />;
    case 'navigation':
      return <NavigationSection />;
    case 'footer':
      return <FooterSection />;
    case 'testimonials':
      return <TestimonialsSection />;
    case 'challenges':
      return <ChallengesSection />;
    case 'media':
      return <MediaSection />;
    case 'search':
      return <SearchSeoSection />;
    case 'feature-toggles':
      return <FeaturesSection />;
    case 'students':
      return <StudentsSection />;
    case 'analytics':
      return <AnalyticsSection />;
    case 'leaderboards':
      return <LeaderboardsSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'campaigns':
      return <CampaignsSection />;
    case 'scheduling':
      return <SchedulingSection />;
    case 'reports':
      return <ReportsSection />;
    case 'health':
      return <HealthSection />;
    case 'import-export':
      return <ImportExportSection />;
    case 'preferences':
      return <PreferencesSection />;
    case 'classic':
      return (
        <div>
          <div className="mb-4 rounded-[var(--ec-radius)] border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            <strong>Classic console.</strong> These tools are unchanged from the original admin build, including the
            preserved YouTube playlist importer. New sections use the settings workspace above.
          </div>
          <AdminLegacyPanel embedded />
        </div>
      );
    default:
      if (isContentTab(slug)) return <ContentToolSection slug={slug} />;
      return (
        <div className="ec-card p-8 text-center">
          <p className="text-sm font-bold">{meta.label}</p>
          <p className="text-xs text-ink-500 mt-1">{meta.description}</p>
        </div>
      );
  }
}
