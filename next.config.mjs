/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build output folder. Defaults to .next. Set NEXT_DIST_DIR (e.g. ".next-check") to run a second
  // dev server or a test build without touching the one you are using: two servers sharing one
  // folder corrupt each other's files ("__webpack_modules__[moduleId] is not a function").
  // Note: Next.js adds "<folder>/types/**/*.ts" to tsconfig.json when it starts; revert that afterwards.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
