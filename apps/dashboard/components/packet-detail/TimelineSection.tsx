import React from "react";
import { getNotes, getStatusHistory, getWrStatus } from "../../lib/packet-fetchers";
import { formatDateTime, docKindLabel, formatDate, timeAgo } from "../../lib/format";

export function TimelineSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-1 animate-pulse">
      <div className="h-3 w-36 bg-paper rounded mb-4" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <div className="w-8 h-8 rounded-full bg-paper shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1.5">
            <div className="h-3 bg-paper rounded" style={{ width: `${55 + i * 8}%` }} />
          </div>
          <div className="h-3 w-20 bg-paper rounded shrink-0 mt-2" />
        </div>
      ))}
    </section>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryRow = {
  history_id: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
  reason: string | null;
};

type DocRow = {
  document_id: string;
  document_kind: string;
  uploaded_at: string;
  original_filename: string | null;
};

type NoteRow = { note_id: string; created_at: string; is_internal: boolean };

type RiskRow = {
  score: number | null;
  tier: string | null;
  engine_version: string | null;
  created_at: string;
};

type ExtRow = {
  extraction_id: string;
  document_id: string;
  extracted_at: string;
  extractor_model: string | null;
  overall_confidence: number | null;
  uploaded_documents: { document_kind: string; original_filename: string | null } | null;
};

type ArgyleConn = { linked_at: string | null } | null;
type WrLite = {
  compliance_status: string | null;
  determined_at: string;
  is_subject: boolean;
  exemption_type: string | null;
} | null;

// ── UnifiedTimeline UI ────────────────────────────────────────────────────────

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-3 px-4 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-3">
      <span className="text-muted text-[16px] shrink-0">○</span>
      <p className="text-[13px] text-graphite leading-snug">
        <span className="font-semibold">{title}</span>
        <span className="text-muted"> · {description}</span>
      </p>
    </div>
  );
}

function UnifiedTimeline({
  history,
  docs,
  notes,
  riskHistory,
  extractions,
  argyleConn,
  wrStatus,
}: {
  history: HistoryRow[];
  docs: DocRow[];
  notes: NoteRow[];
  riskHistory: RiskRow[];
  extractions: ExtRow[];
  argyleConn: ArgyleConn;
  wrStatus: WrLite;
}) {
  type Event = {
    id: string;
    at: string;
    icon: string;
    iconBg: string;
    title: React.ReactNode;
    detail?: string;
  };

  const events: Event[] = [];

  for (const h of history) {
    events.push({
      id: `h-${h.history_id}`,
      at: h.occurred_at,
      icon: "↗",
      iconBg: "bg-indigo/15 text-indigo",
      title: (
        <span>
          Status moved from{" "}
          <span className="font-semibold text-graphite">{h.from_status ?? "—"}</span> to{" "}
          <span className="font-semibold text-ink">{h.to_status}</span>
        </span>
      ),
      detail: h.reason ?? undefined,
    });
  }

  for (const d of docs) {
    const kindLabel = docKindLabel(d.document_kind);
    events.push({
      id: `d-${d.document_id}`,
      at: d.uploaded_at,
      icon: "↥",
      iconBg: "bg-teal/15 text-teal",
      title: (
        <span>
          <span className="font-semibold text-ink">{kindLabel}</span> uploaded
        </span>
      ),
      detail: d.original_filename ?? undefined,
    });
  }

  for (const n of notes) {
    events.push({
      id: `n-${n.note_id}`,
      at: n.created_at,
      icon: "✎",
      iconBg: "bg-graphite/15 text-graphite",
      title: (
        <span>
          Navigator added a{" "}
          {n.is_internal ? (
            <span className="font-semibold text-ink">private note</span>
          ) : (
            <span className="font-semibold text-ink">note visible to applicant</span>
          )}
        </span>
      ),
    });
  }

  const chrono = [...riskHistory].reverse();
  for (let i = 0; i < chrono.length; i++) {
    const r = chrono[i];
    if (!r) continue;
    const prev = i > 0 ? chrono[i - 1] : null;
    const isFirst = !prev;
    if (r.score == null) continue;
    if (isFirst) {
      events.push({
        id: `risk-${r.created_at}`,
        at: r.created_at,
        icon: "⚙",
        iconBg: "bg-indigo/15 text-indigo",
        title: (
          <span>
            Automated review —{" "}
            <span className="font-semibold text-ink tabular-nums">{r.score}</span>
            <span className="text-muted"> / 100</span>
            {r.tier && <span className="text-muted"> · {r.tier}</span>}
          </span>
        ),
      });
    } else if (prev && prev.score != null) {
      const delta = r.score - prev.score;
      if (delta === 0) continue;
      const improved = delta < 0;
      events.push({
        id: `risk-${r.created_at}`,
        at: r.created_at,
        icon: improved ? "↘" : "↗",
        iconBg: improved ? "bg-teal/15 text-teal" : "bg-warning/15 text-warning",
        title: (
          <span>
            Risk re-scored —{" "}
            <span className="tabular-nums text-muted">{prev.score}</span>
            <span className="text-muted"> → </span>
            <span className="font-semibold text-ink tabular-nums">{r.score}</span>
            <span
              className={`ml-2 text-[12px] font-semibold ${improved ? "text-teal" : "text-warning"}`}
            >
              {improved ? "−" : "+"}
              {Math.abs(delta)} pts
            </span>
          </span>
        ),
        detail: improved ? "verification improved" : "new signal raised risk",
      });
    }
  }

  for (const ex of extractions) {
    const kind = ex.uploaded_documents?.document_kind ?? "document";
    const kindLabel = docKindLabel(kind);
    const conf =
      ex.overall_confidence != null ? Math.round(ex.overall_confidence * 100) : null;
    events.push({
      id: `ext-${ex.extraction_id}`,
      at: ex.extracted_at,
      icon: "⊕",
      iconBg: "bg-pine/15 text-pine",
      title: (
        <span>
          <span className="font-semibold text-ink">{kindLabel}</span> read by Civica
          {conf != null && (
            <span className="ml-2 text-[12px] font-semibold tabular-nums text-pine">
              {conf}% confidence
            </span>
          )}
        </span>
      ),
    });
  }

  if (argyleConn?.linked_at) {
    events.push({
      id: `argyle-${argyleConn.linked_at}`,
      at: argyleConn.linked_at,
      icon: "⚡",
      iconBg: "bg-teal/15 text-teal",
      title: (
        <span>
          <span className="font-semibold text-ink">Payroll connected</span> via Argyle
          <span className="ml-2 text-[12px] font-semibold text-teal">
            income now independently verified
          </span>
        </span>
      ),
    });
  }

  if (wrStatus?.determined_at) {
    const passed = !wrStatus.is_subject || wrStatus.compliance_status === "compliant";
    events.push({
      id: `wr-${wrStatus.determined_at}`,
      at: wrStatus.determined_at,
      icon: passed ? "✓" : "!",
      iconBg: passed ? "bg-teal/15 text-teal" : "bg-warning/15 text-warning",
      title: (
        <span>
          Work-hours rule —{" "}
          <span className="font-semibold text-ink">
            {!wrStatus.is_subject ? "not subject" : (wrStatus.compliance_status ?? "unknown")}
          </span>
        </span>
      ),
      detail: wrStatus.exemption_type ?? undefined,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (events.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="status changes, uploads, and automated reviews will appear here in order"
      />
    );
  }

  return (
    <ol className="relative space-y-3">
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-hairline" aria-hidden />
      {events.map((e) => (
        <li key={e.id} className="relative flex items-start gap-3 pl-0">
          <div
            className={`w-8 h-8 rounded-full ${e.iconBg} flex items-center justify-center text-[14px] font-semibold shrink-0 relative z-10 bg-surface ring-4 ring-surface`}
          >
            <span>{e.icon}</span>
          </div>
          <div className="flex-1 min-w-0 pt-1.5">
            <p className="text-[14px] text-graphite leading-snug">{e.title}</p>
            {e.detail && (
              <p className="text-[12px] text-muted italic mt-0.5">&ldquo;{e.detail}&rdquo;</p>
            )}
          </div>
          <span className="text-[12px] text-muted tabular-nums shrink-0 pt-2">
            {formatDateTime(e.at)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Async section export ──────────────────────────────────────────────────────

export default async function TimelineSection({
  packetId,
  riskHistory,
  docs,
  extractions,
  argyleConn,
}: {
  packetId: string;
  riskHistory: RiskRow[];
  docs: DocRow[];
  extractions: ExtRow[];
  argyleConn: ArgyleConn;
}) {
  const [history, notes, wrStatus] = await Promise.all([
    getStatusHistory(packetId),
    getNotes(packetId),
    getWrStatus(packetId),
  ]);

  // Suppress unused import warning — timeAgo is imported for potential
  // future use in timeline entries; formatDate is used in WR event detail.
  void timeAgo;
  void formatDate;

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="mb-5">
        <h2 className="section-title">Activity Timeline</h2>
        <p className="section-sub mt-1 leading-snug">
          Status changes, document work, and every automated review — in order.
        </p>
      </div>
      <UnifiedTimeline
        history={history as HistoryRow[]}
        docs={docs}
        notes={notes as NoteRow[]}
        riskHistory={riskHistory}
        extractions={extractions}
        argyleConn={argyleConn}
        wrStatus={wrStatus as WrLite}
      />
    </section>
  );
}
