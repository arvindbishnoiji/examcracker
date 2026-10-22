'use client';

import { useState } from 'react';
import AdminLegacyPanel, { type AdminTab } from '@/app/admin/_legacy/AdminLegacyPanel';
import { BatchStudioSection } from './BatchStudioSection';
import { AdminPageHeader, Banner, Segmented } from '../ui';

const COPY: Record<string, { title: string; description: string }> = {
  goals: {
    title: 'Daily Study Goals',
    description: 'Create daily targets with IST schedules, CTAs, and JEE/NEET class targeting.',
  },
  batches: {
    title: 'Batches & Visual Card Studio',
    description: 'Manage batches, assign subjects & lectures, or switch to Card Studio to design animated batch cards.',
  },
  series: {
    title: 'Chapter Series',
    description: 'Create topic/subject series, assign subjects, and add ordered lectures and PDF resources.',
  },
  lectures: {
    title: 'Lectures & PDF Notes',
    description: 'Add video lectures, attach PDF notes, or import an entire YouTube playlist into a subject.',
  },
  tests: {
    title: 'Mock Tests & Question Banks',
    description: 'Configure NTA-style test schedules, marks, negative marking, and question banks.',
  },
  events: {
    title: 'Events & Revision Marathons',
    description: 'Schedule live doubt sessions, revision marathons, and mock test announcements.',
  },
  announcements: {
    title: 'Student Announcements',
    description: 'Post notices targeted to JEE, NEET, Class 11, Class 12, or Dropper students.',
  },
  students: {
    title: 'Students & Enrollments',
    description: 'Search student profiles and grant or revoke batch/series access.',
  },
};

export function ContentToolSection({ slug }: { slug: string }) {
  const [batchView, setBatchView] = useState<'manage' | 'studio'>('manage');
  const copy = COPY[slug] || {
    title: 'Content Manager',
    description: 'Manage persisted learning content in Cloudflare D1.',
  };

  if (slug === 'batches' && batchView === 'studio') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            options={[
              { value: 'manage', label: '1. Manage Batches, Subjects & Lectures' },
              { value: 'studio', label: '2. Design Batch Card Appearance' },
            ]}
            value={batchView}
            onChange={setBatchView}
          />
        </div>
        <BatchStudioSection />
      </div>
    );
  }

  const tab: AdminTab = slug as AdminTab;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Courses & Content"
        title={copy.title}
        description={copy.description}
        actions={
          slug === 'batches' ? (
            <Segmented
              options={[
                { value: 'manage', label: 'Manage Batches & Subjects' },
                { value: 'studio', label: 'Batch Card Studio' },
              ]}
              value={batchView}
              onChange={setBatchView}
            />
          ) : undefined
        }
      />

      <Banner tone="info" title="Quick workflow tip">
        For any Batch or Series: click <strong>Manage</strong> → assign or create a <strong>Subject</strong> → click{' '}
        <strong>Open subject · Add lecture</strong> so students see clean chapter-wise queues.
      </Banner>

      <div className="mt-4">
        <AdminLegacyPanel embedded initialTab={tab} />
      </div>
    </div>
  );
}
