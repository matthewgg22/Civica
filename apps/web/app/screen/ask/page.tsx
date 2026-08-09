// /screen/ask — the public Demeter chat, now living inside the screening
// tool's own route tree instead of the standalone /demeter page it used to
// be (2026-08-09 merge). Same server shell as the old page: metadata + the
// verified-state list (from the client-safe packs entry — never the root
// barrel, which drags the 1MB corpus) — DemeterChat itself is unchanged.
//
// /screen is now the whole Demeter AI public surface: this route is the
// "ask a question" entry point (no sign-in), /screen/session is the
// accounts-gated case-file builder. The old /demeter path 301s here — see
// app/demeter/page.tsx.

import type { Metadata } from "next";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../../../components/DemeterChat";

export const metadata: Metadata = {
  title: "Demeter AI — verified SNAP answers",
  description:
    "Ask anything about SNAP (food stamps) and get answers grounded in the actual rules — federal regulations plus adversarially verified state policy, with citations you can check.",
  openGraph: {
    title: "Demeter AI — verified SNAP answers",
    description:
      "Ask anything about SNAP and get answers grounded in the actual rules, with citations you can check.",
    type: "website",
  },
};

export default async function ScreenAskPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string }>;
}) {
  const { state, q } = await searchParams;
  const states = VERIFIED_STATES.map((s) => ({
    code: s.code,
    program: s.program,
    verified: true as const,
  }));
  const initialState =
    state && states.some((s) => s.code === state.toUpperCase()) ? state.toUpperCase() : null;
  return (
    <main className="demeter-page">
      <DemeterChat states={states} initialState={initialState} initialQuestion={q ?? null} />
    </main>
  );
}
