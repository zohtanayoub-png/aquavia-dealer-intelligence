import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['exceljs'],
  eslint: { dirs: ['src', 'prisma'] },
};

export default nextConfig;
