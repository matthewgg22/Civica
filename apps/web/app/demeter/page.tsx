// /demeter — retired 2026-08-09. The public chat now lives at /screen/ask,
// folded into the screening tool's own route tree so "Demeter AI" is one
// surface (/screen) instead of two unrelated top-level routes. This page
// stays only as a permanent redirect so old links/bookmarks/search results
// (and any `?state=`/`?q=` query params they carry — see /guides/[state]
// and /verify, which used to deep-link here) still land somewhere real.

import { permanentRedirect } from "next/navigation";

export default async function DemeterRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.toString();
  permanentRedirect(suffix ? `/screen/ask?${suffix}` : "/screen/ask");
}
