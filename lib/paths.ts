/**
 * The deploy-time base path (e.g. "/goodoc" on a GitHub project page).
 * `next/link` and `next/image` prepend this automatically, but raw URLs that
 * we build by hand — and `/`-rooted links/images inside Markdown — do not, so
 * we prefix them with this helper.
 */
// Must match the gating in next.config.ts: the base path applies to production
// builds only, so dev (and its content links/images) always works at the root.
export const basePath =
  process.env.NODE_ENV === "production"
    ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
    : "";

/** Prefix an absolute, site-rooted path ("/foo") with the deploy base path. */
export function withBasePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${basePath}${path}`;
}
