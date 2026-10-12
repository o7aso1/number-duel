/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Allow phones/PCs on the same machine to load development assets.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    // This environment cannot capture output from detached TypeScript CLI processes.
    useTypeScriptCli: false,
    webpackBuildWorker: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
