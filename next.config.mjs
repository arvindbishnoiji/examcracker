/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  webpack: (config) => config
};

export default nextConfig;
