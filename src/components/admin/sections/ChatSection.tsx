'use client';

import { AdminChatTab } from '@/app/admin/_legacy/AdminLegacyPanel';
import { AdminPageHeader, Banner, StatusPill } from '../ui';

/**
 * Doubt-chat console. Reuses the preserved legacy chat implementation instead of
 * duplicating the Firestore subscription and reply flow.
 */
export function ChatSection() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Communication"
        title="Doubt chat"
        description="Read and reply to student doubt threads. Each student only ever sees their own conversation, and Firestore rules enforce sender identity."
        meta={
          <>
            <StatusPill tone="info">Firestore live</StatusPill>
            <StatusPill tone="success">Per-student privacy enforced</StatusPill>
          </>
        }
      />
      <div className="mb-4">
        <Banner tone="info" title="How replies appear">
          A reply is delivered live to the student’s /chat screen. Messages are stored under the student’s own thread and
          are never exposed to other students.
        </Banner>
      </div>
      <AdminChatTab />
    </div>
  );
}
