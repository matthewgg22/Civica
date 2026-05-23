"use client";

import { useState } from "react";
import type { CountyDemoData } from "../../lib/countyDemoExposure";
import { STATE_PER_PCT, STATE_PENALTY_THRESHOLD_PCT, STATE_PENALTY_EXPOSURE } from "../../lib/countyDemoExposure";

type Props = {
  county: CountyDemoData;
};

export default function CountyExposurePanel({ county }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  async function handleShare() {
    if (typeof navigator === "undefined") return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 2200);
      } else {
        setCopyState("fallback");
      }
    } catch {
      setCopyState("fallback");
    }
  }

  return (
    <div className="space-y-6">
      {/* DEMO banner — visually distinct, cannot be missed */}
      <div className="rounded-[6px] border-l-4 border-wheat bg-wheat-surface px-5 py-3.5">
        <p className="text-[12px] uppercase tracking-wider font-bold text-ink/80">Demo view</p>
        <p className="text-[14px] text-ink mt-1 leading-snug">
          County exposure estimates only. All figures are estimates based on public CDSS + ACS data.
          Actual county PER requires FNS QC data — methodology disclosed below.
        </p>
      </div>

      {/* Hero — county name + headline exposure */}
      <header className="space-y-2">
        <p className="eyebrow">OBBBA §10102 / §10105 exposure</p>
        <h1 className="text-[34px] font-bold tracking-tight text-ink leading-tight">
          {county.displayName}
        </h1>
        <p className="text-[15px] text-graphite max-w-2xl leading-relaxed">{county.notableContext}</p>
      </header>

      {/* Exposure stats grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-hairline rounded-[6px] p-5">
          <p className="eyebrow">Caseload share</p>
          <p className="text-[36px] font-bold tabular-nums text-ink leading-none mt-2">
            {county.caseloadSharePctLabel}
          </p>
          <p className="text-[12px] text-graphite mt-2 leading-snug">
            of CA's ~4.7M household CalFresh caseload (CDSS DSS-8202)
          </p>
        </div>

        <div className="bg-surface border-l-4 border-brick border-y border-r border-hairline rounded-[6px] p-5">
          <p className="eyebrow">Estimated §10105 exposure</p>
          <p className="text-[36px] font-bold tabular-nums text-brick leading-none mt-2">
            {county.estimatedExposureLabel}
          </p>
          <p className="text-[12px] text-graphite mt-2 leading-snug">
            caseload share × ${(STATE_PENALTY_EXPOSURE / 1_000_000).toFixed(0)}M state cumulative
            FY2026–28 penalty exposure
          </p>
        </div>

        <div className="bg-surface border border-hairline rounded-[6px] p-5">
          <p className="eyebrow">§10102 newly in scope</p>
          <p className="text-[36px] font-bold tabular-nums text-ink leading-none mt-2">
            {county.ageGapLabel}
          </p>
          <p className="text-[12px] text-graphite mt-2 leading-snug">
            residents 18–54 newly in ABAWD scope or losing prior exemptions (ACS 5-yr proxy)
          </p>
        </div>
      </section>

      {/* State context strip */}
      <section className="bg-paper border border-hairline rounded-[6px] p-5">
        <p className="eyebrow mb-3">California statewide context</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px]">
          <div>
            <p className="text-graphite">Statewide PER (FY2023)</p>
            <p className="text-[20px] font-bold tabular-nums text-ink mt-1">{STATE_PER_PCT}%</p>
          </div>
          <div>
            <p className="text-graphite">§10105 penalty threshold</p>
            <p className="text-[20px] font-bold tabular-nums text-ink mt-1">{STATE_PENALTY_THRESHOLD_PCT}%</p>
            <p className="text-[12px] text-graphite mt-1">105% × national avg</p>
          </div>
          <div>
            <p className="text-graphite">CA above threshold by</p>
            <p className="text-[20px] font-bold tabular-nums text-brick mt-1">
              +{(STATE_PER_PCT - STATE_PENALTY_THRESHOLD_PCT).toFixed(2)}pp
            </p>
            <p className="text-[12px] text-graphite mt-1">FY2026 window open now</p>
          </div>
        </div>
      </section>

      {/* Credibility / methodology disclosure — the rule from the design doc */}
      <section className="bg-surface border border-hairline rounded-[6px] p-5">
        <p className="eyebrow mb-2">Methodology — read this before you push back</p>
        <p className="text-[14px] text-ink leading-relaxed">
          Estimated based on {county.displayName}'s share ({county.caseloadSharePctLabel}) of
          CA caseload and CA's statewide {STATE_PER_PCT}% PER. <strong>Actual county PER requires FNS QC
          data — FOIA pending.</strong> County-level PER is independently measured by FNS QC reviewers;
          the figure above is a directional estimate using state PER as a proxy, not the
          actual county measurement. The §10102 newly-in-scope figure is an ACS 5-year demographic
          proxy (residents 18–54 without dependent children under 14), not a CalFresh-specific
          count. If you have a different methodology preference, tell us — we built this view
          to start the conversation, not end it.
        </p>
      </section>

      {/* Share + outreach CTA */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-pine-surface border border-hairline rounded-[6px] p-5">
        <div>
          <p className="text-[15px] font-bold text-ink">Share this view</p>
          <p className="text-[13px] text-graphite mt-0.5">Send the URL to a colleague or county collaborator.</p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleShare}
            className="px-4 py-2 bg-pine text-paper rounded-[4px] font-semibold text-[14px] hover:bg-pine-pressed transition-colors"
          >
            {copyState === "copied" ? "Link copied ✓" : copyState === "fallback" ? "Copy URL below ↓" : "Copy share URL"}
          </button>
          <a
            href={`mailto:hello@civica.app?subject=${encodeURIComponent(`${county.displayName} §10102 exposure — 20 minutes?`)}`}
            className="px-4 py-2 bg-surface border border-hairline text-ink rounded-[4px] font-semibold text-[14px] hover:bg-paper transition-colors text-center"
          >
            Email Civica
          </a>
        </div>
      </section>

      {/* Clipboard fallback — read-only input visible only when navigator.clipboard unavailable */}
      {copyState === "fallback" && shareUrl && (
        <section className="bg-paper border border-hairline rounded-[6px] p-4">
          <p className="text-[12px] text-graphite mb-2">
            Clipboard API unavailable. Select and copy the URL below:
          </p>
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-surface border border-hairline rounded-[3px] px-3 py-2 text-[13px] font-mono text-ink focus:outline-none focus:border-pine"
          />
        </section>
      )}
    </div>
  );
}
