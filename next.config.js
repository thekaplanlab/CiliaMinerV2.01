/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Configure for GitHub Pages deployment
  basePath: process.env.NODE_ENV === 'production' ? '/Ciliaminer_v2' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Ciliaminer_v2/' : '',
}

module.exports = nextConfig
