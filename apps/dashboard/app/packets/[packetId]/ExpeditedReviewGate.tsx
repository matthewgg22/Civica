"use client";

import { useTransition } from "react";
import { recordExpeditedReview } from "./actions";

interface Props {
  packetId: string;
}

export default function ExpeditedReviewGate({ packetId }: Props) {
  const [isPending, startTransition] = useTransition();

  function decide(isExpedited: boolean) {
    startTransition(() => { void recordExpeditedReview(packetId, isExpedited); });
  }

  return (
    <section className="bg-surface border border-warning/50 rounded-[4px] overflow-hidden ring-1 ring-warning/20">
      <div className="h-1 w-full bg-warning" />
      <div className="px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-warning mb-1">
          Expedited Review Required · OBBBA §10102(a)
        </p>
        <h3 className="text-[17px] font-semibold text-ink leading-snug">
          This applicant may qualify for expedited SNAP processing
        </h3>
        <p className="text-[14px] text-graphite mt-2 leading-relaxed">
          Answers indicate the applicant is unemployed with very low income.
          Under 7&nbsp;CFR&nbsp;273.2(i), households with gross income under $150/month
          and liquid resources under $100 are entitled to expedited processing within 7 days.
          Please review and confirm how to proceed before advancing this packet.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => decide(true)}
            disabled={isPending}
            className="px-4 py-2 bg-warning text-white text-[13px] font-semibold rounded-[4px] hover:bg-warning/90 disabled:opacity-50 transition-colors"
          >
            Confirm expedited routing
          </button>
          <button
            onClick={() => decide(false)}
            disabled={isPending}
            className="px-4 py-2 bg-paper border border-hairline text-[13px] font-semibold text-graphite rounded-[4px] hover:bg-surface disabled:opacity-50 transition-colors"
          >
            Continue standard review
          </button>
        </div>
        {isPending && (
          <p className="text-[12px] text-muted mt-3">Saving…</p>
        )}
      </div>
    </section>
  );
}
