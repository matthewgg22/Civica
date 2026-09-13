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
//
// THIS FUNCTION MUST NEVER THROW, and that is not a style preference — it is
// the fix for a production outage (2026-09-12). The root layout does
// `metadataBase: new URL(siteUrl())`, so whatever comes back is fed straight
// to the URL parser on every render. When NEXT_PUBLIC_SITE_URL was set to a
// bare hostname (`civica-applicant.vercel.app`, no scheme) the parser threw
// ERR_INVALID_URL during metadata resolution, and because metadata resolves
// per request for dynamic routes but is baked in at build time for static
// ones, the blast radius was exactly the pages that matter: /chat,
// /screen/ask, /screen, /sign-in and every other server-rendered page hit the
// error boundary, while /questions, /states, /safety and the sitemap kept
// serving. Uptime checks and crawlers saw a healthy site; every human saw
// "This page didn't load."
//
// So a malformed value now degrades to the next source in the order above
// instead of taking the site down. It is logged once, loudly, because a wrong
// canonical origin is still a real bug — just not one worth a 500.

const FALLBACK = "http://localhost:3000";

/** Warn once per process, not once per render — a dynamic page re-resolves
 *  metadata on every request, and a per-request log would bury the signal in
 *  its own noise. */
let warned = false;
function warnOnce(name: string, raw: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `[site-url] ${name} is not a usable origin (${JSON.stringify(raw)}). ` +
      `Falling back. Set it to a full origin, e.g. https://example.com`,
  );
}

/** Coerce a configured value into a valid absolute origin, or null.
 *
 *  A bare hostname is the mistake this exists to absorb: `example.com` is what
 *  a person types when a field is labelled "site URL", and it is exactly what
 *  `new URL()` rejects. Prepending https:// is what they meant. Anything still
 *  unparseable after that, or on a non-web protocol, is a value we refuse to
 *  guess at. */
function normalizeOrigin(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  // http/https only. A `mailto:` or `file:` origin in metadataBase would parse
  // and then produce nonsense canonical URLs, which is worse than falling back.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname) return null;
  // Return the scheme-corrected input, not parsed.origin: a deployment under
  // a sub-path is legitimate and every caller concatenates onto this, so the
  // path has to survive. Only the trailing slash goes, as it always did.
  return stripTrailingSlash(withScheme);
}

export function siteUrl(): string {
  const explicitRaw = process.env.NEXT_PUBLIC_SITE_URL;
  const explicit = normalizeOrigin(explicitRaw);
  if (explicit) return explicit;
  if (explicitRaw && explicitRaw.trim()) warnOnce("NEXT_PUBLIC_SITE_URL", explicitRaw);

  const vercelRaw = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelProd = normalizeOrigin(vercelRaw);
  if (vercelProd) return vercelProd;
  if (vercelRaw && vercelRaw.trim()) warnOnce("VERCEL_PROJECT_PRODUCTION_URL", vercelRaw);

  return FALLBACK;
}

/** True once a real canonical domain is configured — used to decide whether
 *  it is honest to advertise the site to crawlers at all. Reflects what
 *  `siteUrl()` actually resolved, so a malformed env var reads as "no
 *  canonical domain" rather than as a domain we cannot build URLs for. */
export function hasCanonicalDomain(): boolean {
  return siteUrl() !== FALLBACK;
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
