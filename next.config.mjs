/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The live preview proxy uses a dynamic `<port>-<sandbox>.e2b.app` origin.
  // Allow it during dev so Next's cross-origin dev-asset checks stay explicit.
  allowedDevOrigins: ['*.e2b.app'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '**' }
    ],
    unoptimized: true
  },
  experimental: {
    // keep empty for Cloudflare compat
  },
  // prevent server component from bundling firebase browser APIs
  webpack: (config) => config,
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }];
    const privatePaths = [
      '/admin/:path*',
      '/home',
      '/onboarding',
      '/lectures/:path*',
      '/tests/:path*',
      '/leaderboard',
      '/profile',
      '/search',
      '/events',
      '/challenges',
      '/chat',
      '/notifications',
    ];
    return [
      {
        // Defence in depth: robots.txt asks crawlers to stay out, and the
        // response header prevents indexing even if a private URL leaks.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      ...privatePaths.map((source) => ({ source, headers: noindex })),
    ];
  },
};

export default nextConfig;
