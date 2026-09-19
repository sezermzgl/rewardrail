import type { NextConfig } from 'next';

/**
 * The validator is a plain Express service with no CORS headers, so a browser
 * refuses to call it cross-origin. Rather than loosening the backend, the
 * panels call a same-origin path and Next forwards it.
 *
 * Same-origin also means the POSTs in #14–#16 never trigger a preflight, and
 * there is no CORS configuration to get wrong wherever this is served.
 */
const VALIDATOR_ORIGIN = process.env.VALIDATOR_ORIGIN ?? 'http://localhost:8787';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/validator/:path*',
        destination: `${VALIDATOR_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
