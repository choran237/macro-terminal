/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow server-side fetch to Yahoo Finance
  experimental: {},
  // Suppress noisy build warnings from optional peer deps
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these — they don't exist in Node/Vercel environment
      config.externals = [...(config.externals || [])];
    }
    return config;
  },
};
module.exports = nextConfig;
