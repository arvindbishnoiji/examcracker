import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Design preview',
  description: 'Internal storefront style guide for the Exam Cracker Aurora design system.',
  robots: { index: false, follow: false, nocache: true },
};

export default function DesignPreviewLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
