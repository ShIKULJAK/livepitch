import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.0.4',
    '109.165.198.76',
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ],
};

export default nextConfig;
