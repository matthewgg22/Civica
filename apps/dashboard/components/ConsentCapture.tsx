"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

interface Props {
  applicantId: string;
  hasConsent: boolean;
  consentedAt?: string | null;
}

const CONSENT_METHODS = [
  { value: "ios_checkbox", label: "iOS app checkbox (applicant self-service)" },
  { value: "web_checkbox", label: "Web portal checkbox (applicant self-service)" },
  { value: "navigator_proxy", label: "Navigator proxy — verbal consent documented" },
  { value: "paper_form", label: "Paper form — signed copy on file" },
] as const;

type ConsentMethod = typeof CONSENT_METHODS[number]["value"];

const POLICY_VERSION = "1.0";

export default function ConsentCapture({ applicantId, hasConsent, consentedAt }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<ConsentMethod>("ios_checkbox");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setRecording(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      await api.consents.record(session.access_token, {
        applicant_id: applicantId,
        consent_kind: "privacy_notice",
        policy_version: POLICY_VERSION,
        consent_method: method,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record consent");
    } finally {
      setRecording(false);
    }
  }

  if (hasConsent) {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="w-6 h-6 rounded-full bg-teal/15 text-teal flex items-center justify-center text-[13px] font-semibold shrink-0">✓</span>
        <div>
          <p className="text-[14px] font-medium text-ink">Privacy notice consent on file</p>
          {consentedAt && (
            <p className="text-[12px] text-muted mt-0.5 tabular-nums">
              Recorded {new Date(consentedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-[3px] border border-brick/30 bg-brick/8 px-4 py-3">
        <span className="text-brick shrink-0 text-[16px] mt-0.5">!</span>
        <p className="text-[13px] text-graphite leading-snug">
          <span className="font-semibold text-brick">No privacy notice consent recorded.</span>{" "}
          This packet cannot advance to &ldquo;Ready for Handoff&rdquo; until the applicant&apos;s
          consent is on file. Record it below once obtained.
        </p>
      </div>

      <div>
        <label className="text-[12px] font-semibold uppercase tracking-wider text-muted block mb-1.5">
          How was consent obtained?
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as ConsentMethod)}
          className="w-full border border-hairline rounded-[3px] px-3 py-2.5 text-[14px] bg-paper focus:outline-none focus:border-teal focus:bg-white transition-colors"
        >
          {CONSENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={record}
        disabled={recording}
        className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-brick text-white hover:bg-brick/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
      >
        {recording ? "Recording…" : "Record privacy notice consent"}
      </button>

      {error && <p className="text-[13px] text-error">{error}</p>}
    </div>
  );
}
