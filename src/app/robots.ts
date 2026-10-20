import type { MetadataRoute } from 'next';
import { absoluteUrl, PRIVATE_ROUTE_PREFIXES } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login'],
        disallow: [...PRIVATE_ROUTE_PREFIXES, '/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
