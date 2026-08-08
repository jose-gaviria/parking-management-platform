import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    // Dependencies and the shared workspace package are hoisted at the monorepo root.
    root: workspaceRoot,
  },
};

export default nextConfig;
