import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteConfigProvider } from '@/context/SiteConfigContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/hooks/useToast';
import { AppChrome } from '@/components/layout/AppChrome';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Exam Cracker — JEE & NEET Learning',
    template: '%s · Exam Cracker',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['JEE preparation', 'NEET preparation', 'Class 11', 'Class 12', 'mock tests', 'video lectures'],
  authors: [{ name: 'Exam Cracker' }],
  creator: 'Exam Cracker',
  publisher: 'Exam Cracker',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'Exam Cracker — JEE & NEET Learning',
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/og-cover.png', width: 1200, height: 630, alt: 'Exam Cracker — JEE and NEET learning' }],
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Exam Cracker — JEE & NEET Learning',
    description: 'Curated lectures, scheduled mock tests and honest progress tracking for JEE & NEET.',
    images: ['/og-cover.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Truthful organisation/website structured data only: no fake ratings, prices,
 * addresses or course counts. Private/student data is never serialised here.
 */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'EducationalOrganization',
      '@id': absoluteUrl('/#organization'),
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl('/icons/icon-512.png'),
      description: SITE_DESCRIPTION,
      areaServed: 'IN',
    },
    {
      '@type': 'WebSite',
      '@id': absoluteUrl('/#website'),
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { '@id': absoluteUrl('/#organization') },
      inLanguage: 'en-IN',
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <SiteConfigProvider>
          <AuthProvider>
            <ToastProvider>
              <AppChrome>{children}</AppChrome>
            </ToastProvider>
          </AuthProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
