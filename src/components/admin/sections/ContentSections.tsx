'use client';

import AdminLegacyPanel, { type AdminTab } from '@/app/admin/_legacy/AdminLegacyPanel';
import { AdminPageHeader, Banner } from '../ui';

const COPY: Record<string, { title: string; description: string }> = {
  goals: {
    title: "Today's Goals",
    description: 'Daily targets with IST schedules, CTAs and exam/class targeting — managed by the original, working content console.',
  },
  batches: {
    title: 'Batches',
    description: 'Create a batch, open its workspace, assign subjects and add lectures in the correct learning path.',
  },
  series: {
    title: 'Series',
    description: 'Organize series by subject or chapter, then add ordered lectures and resources beneath each subject.',
  },
  lectures: {
    title: 'Lectures & Resources',
    description: 'Search the lecture library or open a batch/series subject workspace to add content in context.',
  },
  tests: {
    title: 'Tests & Question Banks',
    description: 'Schedules, marks and validated JSON question banks.',
  },
  events: {
    title: 'Events & Calendar',
    description: 'Mock tests, marathons, doubt sessions and result announcements.',
  },
  announcements: {
    title: 'Announcements',
    description: 'Scheduled notices targeted by exam and class.',
  },
  students: {
    title: 'Students & Enrollments',
    description: 'Search student profiles, inspect onboarding choices and manage batch/series access.',
  },
  chat: {
    title: 'Student Chat',
    description: 'Reply to student threads in real time.',
  },
  classic: {
    title: 'Classic Content Tools',
    description: 'The complete original admin console. Nothing here has been removed or altered.',
  },
};

export function ContentToolSection({ slug }: { slug: string }) {
  const copy = COPY[slug] || COPY.classic;
  const tab: AdminTab =
    slug === 'classic'
      ? 'overview'
      : (slug as AdminTab);
  return (
    <div>
      <AdminPageHeader
        eyebrow={slug === 'classic' ? 'System' : 'Learning'}
        title={copy.title}
        description={copy.description}
        meta={
          <>
            <span className="rounded-full border border-ink-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-ink-600">
              Stored in Cloudflare D1
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Preserved workflow
            </span>
          </>
        }
      />
      <Banner tone="info" title="Manage persisted learning content">
        Changes are saved through the authenticated D1 API. For a batch or series, choose Manage → assign or create a subject → Open subject · Add lecture. Disable preserves records; permanent deletion is guarded when students, progress, files or relationships still depend on an item.
      </Banner>
      <div className="mt-4">
        <AdminLegacyPanel embedded initialTab={tab} />
      </div>
    </div>
  );
}
