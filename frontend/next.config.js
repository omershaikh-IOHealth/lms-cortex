/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
    return [
      // Proxy all API calls to the LMS backend
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // KEY FIX: Proxy video uploads so they're accessible from any device
      // on the LAN via the frontend URL — avoids CORS and direct-IP issues
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;