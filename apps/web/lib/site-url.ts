// The canonical origin for absolute URLs (sitemap, robots, OG tags, JSON-LD).
//
// Resolution order matters, because getting this wrong is silent: a sitemap
// full of preview-deployment hostnames teaches Google to index throwaway URLs
// that 404 next week.
//
//   1. NEXT_PUBLIC_SITE_URL — set this to the real domain in production.
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's stable production hostname,
//      which (unlike VERCEL_URL) does NOT change per deployment.
//   3. localhost — dev only.
//
// Deliberately NOT falling back to VERCEL_URL: that is the per-deployment
// hash (web-1lgoaf736-…), and a sitemap built from it would point search
// engines at a URL that dies on the next push.

const FALLBACK = "http://localhost:3000";

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${stripTrailingSlash(vercelProd)}`;
  return FALLBACK;
}

/** True once a real canonical domain is configured — used to decide whether
 *  it is honest to advertise the site to crawlers at all. */
export function hasCanonicalDomain(): boolean {
  return !!(process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL);
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
