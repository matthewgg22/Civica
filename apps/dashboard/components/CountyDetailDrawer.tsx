"use client";

import Link from "next/link";
import { useEffect } from "react";
import StatusPill from "./StatusPill";
import { decryptDemoName, firstNameLastInitial, timeAgo, shortId } from "../lib/format";

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
  onClose,
}: {
  countyName: string;
  packets: CountyPacket[];
  onClose: () => void;
}) {
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
        <div className="bg-teal/5 border-b border-teal/20 px-6 py-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-teal">County Detail</p>
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

        {/* Stats — every packet falls into exactly one bucket so totals reconcile */}
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

        {/* Footer */}
        {packets.length > 0 && (
          <div className="border-t border-hairline px-6 py-4 bg-paper/40">
            <Link
              href={`/packets?county=${encodeURIComponent(countyName)}`}
              className="block text-center bg-teal text-white px-4 py-2.5 rounded-[3px] text-[14px] font-semibold hover:bg-teal/90 transition-colors"
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

function Metric({ label, value, accent, bg }: { label: string; value: number; accent: string; bg: string }) {
  return (
    <div className={`${bg} rounded-[4px] px-2.5 py-3 text-center`}>
      <p className={`text-[20px] font-semibold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[10px] font-medium text-graphite mt-1.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}
