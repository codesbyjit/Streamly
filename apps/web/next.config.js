/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  experimental: { optimizePackageImports: ["shaka-player"] }
};

export default nextConfig;