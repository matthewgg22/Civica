"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusPill from "./StatusPill";
import { decryptDemoName, firstNameLastInitial, timeAgo, shortId } from "../lib/format";
import type { PacketRiskEntry } from "./mapTypes";

export type CountyPacket = {
  packet_id: string;
  status: string;
  county: string | null;
  updated_at: string;
  applicants: { full_name_ciphertext: string | null; preferred_language: string } | null;
};

export default function CountyDetailDrawer({
  countyName,
  packets,
  packetRiskMap,
  onClose,
}: {
  countyName: string;
  packets: CountyPacket[];
  packetRiskMap?: Record<string, PacketRiskEntry>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"status" | "risk">("status");
  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const needsAttention = packets.filter((p) => p.status === "Needs Documents" || p.status === "Needs Applicant Clarification").length;
  const ready = packets.filter((p) => p.status === "Ready for Handoff").length;
  const enrolled = packets.filter((p) => p.status === "Handed Off" || p.status === "Closed").length;
  const inProgress = packets.filter((p) => p.status === "Submitted for Review" || p.status === "In Navigator Review").length;
  const draft = packets.filter((p) => p.status === "Draft").length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/30 z-40 transition-opacity duration-200 animate-[fadeIn_0.18s_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={`${countyName} County detail`}
        className="fixed top-0 right-0 h-screen w-full sm:w-[440px] bg-surface shadow-2xl z-50 flex flex-col animate-[slideIn_0.22s_ease-out] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-pine/5 border-b border-pine/20 px-6 py-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-pine">County Detail</p>
            <h3 className="text-[22px] font-semibold tracking-tight text-ink mt-1 leading-tight">{countyName} County</h3>
            <p className="text-[13px] text-graphite mt-1">{packets.length} packet{packets.length === 1 ? "" : "s"} active</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close county detail"
            className="text-graphite hover:text-ink hover:bg-paper transition-colors w-8 h-8 rounded-full flex items-center justify-center text-[20px] shrink-0"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-hairline bg-paper/40">
          <button
            onClick={() => setTab("status")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-[3px] transition-colors ${tab === "status" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-graphite"}`}
          >
            Status
          </button>
          <button
            onClick={() => setTab("risk")}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-[3px] transition-colors ${tab === "risk" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-graphite"}`}
          >
            Error Risk
          </button>
        </div>

        {tab === "status" ? (
          <>
            {/* Stats */}
            <div className="px-6 py-5 border-b border-hairline">
              <div className="grid grid-cols-5 gap-2">
                <Metric label="Draft"     value={draft}          accent="text-graphite" bg="bg-paper" />
                <Metric label="In Prog"   value={inProgress}     accent="text-indigo"   bg="bg-indigo/8" />
                <Metric label="Attention" value={needsAttention} accent="text-amber"    bg="bg-amber/8" />
                <Metric label="Ready"     value={ready}          accent="text-teal"     bg="bg-teal/8" />
                <Metric label="Enrolled"  value={enrolled}       accent="text-brick"    bg="bg-brick/8" />
              </div>
            </div>
            {/* Packet list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {packets.length === 0 ? (
                <p className="text-[14px] text-muted text-center py-8">No packets in this county yet.</p>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-3">Recent Packets</p>
                  <ul className="divide-y divide-hairline">
                    {packets.slice(0, 8).map((p) => {
                      const name = p.applicants ? firstNameLastInitial(decryptDemoName(p.applicants.full_name_ciphertext)) : "Unknown";
                      return (
                        <li key={p.packet_id}>
                          <Link
                            href={`/packets/${p.packet_id}`}
                            className="flex items-center gap-3 py-3 hover:bg-paper/60 -mx-2 px-2 rounded-[3px] transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <p className="text-[15px] font-semibold text-ink truncate">{name}</p>
                                <span className="text-[10px] text-muted font-mono tabular-nums shrink-0">{shortId(p.packet_id)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <StatusPill status={p.status} />
                                <span className="text-[11px] text-muted tabular-nums">{timeAgo(p.updated_at)}</span>
                              </div>
                            </div>
                            <span className="text-muted text-[18px] shrink-0">›</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </>
        ) : (
          <RiskTab packets={packets} packetRiskMap={packetRiskMap} />
        )}

        {/* Footer */}
        {packets.length > 0 && (
          <div className="border-t border-hairline px-6 py-4 bg-paper/40">
            <Link
              href={`/packets?county=${encodeURIComponent(countyName)}`}
              className="block text-center bg-pine text-white px-4 py-2.5 rounded-[3px] text-[14px] font-semibold hover:bg-pine/90 transition-colors"
            >
              View all {packets.length} in queue →
            </Link>
          </div>
        )}
      </aside>

      {/* Inline animations */}
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}

const TIER_TONE = {
  high:   { color: "#9C3A24", label: "High",   bg: "rgba(156,58,36,0.10)" },
  medium: { color: "#9A5A14", label: "Med",    bg: "rgba(154,90,20,0.10)" },
  low:    { color: "#2A6F66", label: "Low",    bg: "rgba(42,111,102,0.10)" },
} as const;

function RiskTab({ packets, packetRiskMap }: { packets: CountyPacket[]; packetRiskMap?: Record<string, PacketRiskEntry> }) {
  const riskPackets = packets.map((p) => ({
    ...p,
    risk: packetRiskMap?.[p.packet_id] ?? null,
  }));
  const scored = riskPackets.filter((p) => p.risk !== null);
  const high   = scored.filter((p) => p.risk?.tier === "high").length;
  const medium = scored.filter((p) => p.risk?.tier === "medium").length;
  const low    = scored.filter((p) => p.risk?.tier === "low").length;
  const topRisk = scored
    .filter((p) => p.risk?.tier === "high" || p.risk?.tier === "medium")
    .sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0))
    .slice(0, 5);

  if (scored.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <p className="text-[13px] text-muted text-center">No risk scores yet for packets in this county.</p>
      </div>
    );
  }

  const total = high + medium + low;
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(["high", "medium", "low"] as const).map((tier) => {
          const n = tier === "high" ? high : tier === "medium" ? medium : low;
          const t = TIER_TONE[tier];
          return (
            <div key={tier} className="rounded-[4px] p-3 text-center border border-hairline" style={{ background: t.bg }}>
              <p className="text-[22px] font-bold tabular-nums" style={{ color: t.color }}>{n}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: t.color }}>{t.label}</p>
            </div>
          );
        })}
      </div>
      {/* Score bar */}
      {total > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden border border-hairline/50">
          {high > 0   && <div style={{ width: `${(high / total) * 100}%`,   background: "#9C3A24" }} />}
          {medium > 0 && <div style={{ width: `${(medium / total) * 100}%`, background: "#9A5A14" }} />}
          {low > 0    && <div style={{ width: `${(low / total) * 100}%`,    background: "#2A6F66" }} />}
        </div>
      )}
      {topRisk.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted mb-3">High / Medium Risk Packets</p>
          <ul className="divide-y divide-hairline">
            {topRisk.map((p) => {
              const name = p.applicants ? firstNameLastInitial(decryptDemoName(p.applicants.full_name_ciphertext)) : "Unknown";
              const tier = p.risk!.tier as "high" | "medium" | "low";
              const tone = TIER_TONE[tier] ?? TIER_TONE.medium;
              return (
                <li key={p.packet_id}>
                  <Link
                    href={`/packets/${p.packet_id}?tab=risk`}
                    className="flex items-center gap-3 py-3 hover:bg-paper/60 -mx-2 px-2 rounded-[3px] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{name}</p>
                      <p className="text-[11px] text-muted">{shortId(p.packet_id)}</p>
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className="text-[18px] font-bold tabular-nums" style={{ color: tone.color }}>{p.risk!.score ?? "—"}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm" style={{ color: tone.color, background: tone.bg }}>{tone.label}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent, bg }: { label: string; value: number; accent: string; bg: string }) {
  return (
    <div className={`${bg} rounded-[4px] px-2.5 py-3 text-center`}>
      <p className={`text-[20px] font-semibold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[10px] font-medium text-graphite mt-1.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}
