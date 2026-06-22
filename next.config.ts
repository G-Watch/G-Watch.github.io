import type { NextConfig } from "next";

/**
 * goodoc is built as a fully static site (`output: "export"`) so it can be
 * hosted on GitHub Pages or any static file host.
 *
 * When deploying to a GitHub *project* page the site lives under a sub-path
 * (e.g. https://<user>.github.io/goodoc). Set NEXT_PUBLIC_BASE_PATH=/goodoc
 * in that environment. Locally it stays empty so `next dev` works at the root.
 */
// Only apply the base path to production builds. `next dev` always serves from
// the root, so a stray NEXT_PUBLIC_BASE_PATH in your shell can't 404 the whole
// dev site. The GitHub Pages build (NODE_ENV=production) still picks it up.
const basePath =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
    : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // GitHub Pages serves files from disk, so directory-style URLs need an
  // index.html in each folder.
  trailingSlash: true,
  images: {
    // The static export target has no Next.js image optimization server.
    unoptimized: true,
  },
};

export default nextConfig;
