import path from 'path';
const isGhPages = process.env.GITHUB_PAGES === 'true';
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isGhPages ? '/pigou-os' : '',
  assetPrefix: isGhPages ? '/pigou-os/' : '',
  turbopack: { root: path.resolve(process.cwd()) },
};
export default nextConfig;
