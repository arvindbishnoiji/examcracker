import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

/**
 * Only genuinely public pages are listed. Student dashboards, lectures, tests,
 * admin screens and media links stay out of the sitemap on purpose.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl('/login'),
      lastModified: new Date('2026-10-20'),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
