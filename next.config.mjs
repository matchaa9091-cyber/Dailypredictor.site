/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages requires the edge runtime for server components/actions to work efficiently
  experimental: {
    runtime: 'edge',
  },
};

export default nextConfig;
