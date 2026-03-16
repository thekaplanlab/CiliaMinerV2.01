/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Configure for GitHub Pages deployment
  basePath: process.env.NODE_ENV === 'production' ? '/CiliaMinerV2.01' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/CiliaMinerV2.01' : '',

  // Turbopack (Next.js 16+ default bundler) handles browser/node fallbacks
  // for packages like xlsx automatically. An empty config opts-in explicitly.
  turbopack: {},
}

module.exports = nextConfig
