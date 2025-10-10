/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Configure for GitHub Pages deployment
  // Use basePath only in production (GitHub Pages)
  basePath: process.env.GITHUB_ACTIONS === 'true' ? '/CiliaMinerV2.01' : '',
  assetPrefix: process.env.GITHUB_ACTIONS === 'true' ? '/CiliaMinerV2.01/' : '',
}

module.exports = nextConfig
