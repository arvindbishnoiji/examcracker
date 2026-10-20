import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Exam Cracker to continue your JEE or NEET preparation.',
  alternates: { canonical: '/login' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Sign in · Exam Cracker',
    description: 'Continue your JEE or NEET preparation.',
    url: '/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
