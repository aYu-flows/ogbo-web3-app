/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Disable server-side features for static export
  trailingSlash: false,
  // Use relative paths for Capacitor compatibility
  assetPrefix: '.',
};

export default nextConfig;
