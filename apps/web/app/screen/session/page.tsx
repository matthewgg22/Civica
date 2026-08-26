// /screen/session — the active screening interface (mockup frames 03/04).
// Distinct from /screen/ask (anonymous open Q&A): this is the accounts-gated
// path with a live case file. Anonymous visitors still land here as a
// guest (5-screening cap, enforced server-side) rather than being blocked —
// the mockup's own "Continue as a guest" path. Reached either from the
// landing page's two CTAs, or directly by a returning org member.

import type { Metadata } from "next";
import { ScreeningChat } from "../../../components/ScreeningChat";

export const metadata: Metadata = {
  title: "Demeter Screening",
  description: "Screen your household's SNAP eligibility. Cited, exportable, state-aware.",
};

export default async function ScreeningSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  // No org-default resolution here (that requires the server-side identity
  // check, which lives in the API route) — the query param covers a direct
  // link from a guide page; the chat's own first turn re-resolves state
  // against the real identity if this is absent.
  const initialState = (state ?? "CA").toUpperCase();
  return <ScreeningChat initialState={initialState} />;
}
