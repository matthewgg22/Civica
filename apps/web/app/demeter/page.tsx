// /demeter — the public Demeter chat page (the pivot's beachhead surface).
// Server shell: metadata + the verified-state list (from the client-safe
// packs entry — never the root barrel, which drags the 1MB corpus).

import type { Metadata } from "next";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../../components/DemeterChat";

export const metadata: Metadata = {
  title: "Demeter — verified SNAP answers",
  description:
    "Ask anything about SNAP (food stamps) and get answers grounded in the actual rules — federal regulations plus adversarially verified state policy, with citations you can check.",
};

export default function DemeterPage() {
  const states = VERIFIED_STATES.map((s) => ({
    code: s.code,
    program: s.program,
    verified: true as const,
  }));
  return (
    <main className="demeter-page">
      <DemeterChat states={states} />
    </main>
  );
}
