import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: 'Admin Control Centre · Exam Cracker',
  description: 'Premium admin console for appearance, content, students and platform health.',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
