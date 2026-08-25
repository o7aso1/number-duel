/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Allow phones/PCs on the same LAN to load Next.js dev assets
  allowedDevOrigins: ['192.168.1.53', '127.0.0.1', 'localhost'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
