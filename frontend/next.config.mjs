/** @type {import('next').NextConfig} */
const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
  // Use relative paths for Capacitor, absolute paths for web (Vercel)
  assetPrefix: isCapacitor ? '.' : '',
};

export default nextConfig;
