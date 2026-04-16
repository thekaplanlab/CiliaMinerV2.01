/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
const isVercel = process.env.VERCEL === '1'

const nextConfig = {
  ...(isVercel ? {} : { output: 'export', trailingSlash: true }),
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true
  },
  turbopack: {},
}

module.exports = nextConfig
