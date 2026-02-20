/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes are now Next.js Route Handlers — no proxy needed
  // Increase body size limit for video uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

module.exports = nextConfig;
