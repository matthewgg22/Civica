"use client";

import { useState } from "react";
import { requestToAssist } from "../../app/cbo/[packetId]/buddy-actions";

// Caseworker self-referral control on the CBO case page. The caseworker requests
// to assist this applicant via the shared buddy system; the applicant must
// approve before the link goes active (consent gate). Shows the live state:
// idle → request, pending (awaiting approval), or active (approved).
type View = "idle" | "loading" | "pending" | "active" | "error";

export default function CaseworkerConnectButton({ packetId }: { packetId: string }) {
  const [view, setView] = useState<View>("idle");
  const [error, setError] = useState<string>("");

  async function onClick() {
    setView("loading");
    setError("");
    const res = await requestToAssist(packetId);
    if (!res.ok) {
      setError(res.error);
      setView("error");
      return;
    }
    setView(res.status === "active" ? "active" : "pending");
  }

  if (view === "pending") {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-warning">
        <span aria-hidden="true">◷</span>
        Request sent — awaiting the applicant&rsquo;s approval
      </p>
    );
  }

  if (view === "active") {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-pine">
        <span aria-hidden="true">✓</span>
        Connected — the applicant approved your request
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={view === "loading"}
        className="inline-flex items-center gap-1.5 self-start rounded-[3px] border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-pine hover:bg-surface-secondary disabled:opacity-50"
      >
        {view === "loading" ? "Sending…" : "Request to assist this applicant"}
      </button>
      {view === "error" && (
        <p className="text-[11px] text-brick" role="alert">{error}</p>
      )}
    </div>
  );
}
