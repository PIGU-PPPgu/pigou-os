import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isGhPages = process.env.GITHUB_PAGES === 'true';
const isStaticExport = isGhPages || process.env.STATIC_EXPORT === 'true';
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isStaticExport ? 'export' : undefined,
  images: { unoptimized: true },
  basePath: isGhPages ? '/pigou-os' : '',
  assetPrefix: isGhPages ? '/pigou-os/' : '',
  turbopack: { root: projectRoot },
};
export default nextConfig;
