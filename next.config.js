/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: true },
  // @react-pdf/renderer ships ESM that Next.js must transpile for browser bundles
  transpilePackages: ['@react-pdf/renderer'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}
module.exports = nextConfig

