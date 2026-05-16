type DocStats = {
  total: number;
  autoExtracted: number;
  avgConfidence: number | null;
  byKind: { kind: string; count: number; autoExtracted: number }[];
};

const KIND_LABEL: Record<string, string> = {
  paystub: "Pay Stub",
  photo_id: "Photo ID",
  lease: "Lease",
  utility_bill: "Utility Bill",
  bank_statement: "Bank Statement",
  tax_return: "Tax Return",
  benefit_letter: "Benefit Letter",
  other: "Other",
};

function kindLabel(k: string): string {
  return KIND_LABEL[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DocumentAIPanel({ stats }: { stats: DocStats }) {
  if (stats.total === 0) {
    return (
      <div className="py-6 px-5 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-teal/15 flex items-center justify-center shrink-0">
          <span className="text-teal text-[18px]">⚙</span>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-ink">Document AI armed</p>
          <p className="text-[13px] text-graphite mt-1 leading-snug">
            Classification + extraction will activate on the first upload. Trained on pay stubs, IDs, utility bills, lease agreements, and benefit letters.
          </p>
        </div>
      </div>
    );
  }
  const autoPct = (stats.autoExtracted / stats.total) * 100;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Metric label="Auto-extracted" value={`${autoPct.toFixed(0)}%`} sub={`${stats.autoExtracted} of ${stats.total} docs`} accent="text-teal" />
        <Metric label="Avg confidence" value={stats.avgConfidence != null ? stats.avgConfidence.toFixed(2) : "—"} sub="classification model" accent="text-ink" />
        <Metric label="Manual review" value={`${(100 - autoPct).toFixed(0)}%`} sub="needs navigator action" accent="text-amber" />
      </div>
      {stats.byKind.length > 0 && (
        <div>
          <p className="section-title mb-3">By Document Type</p>
          <ul className="space-y-3">
            {stats.byKind.map((k) => {
              const pct = k.count > 0 ? (k.autoExtracted / k.count) * 100 : 0;
              // Flag rows with terrible model performance so they don't just blend in
              const lowConfidence = pct < 50 && k.count >= 3;
              const barColor = pct >= 80 ? "bg-teal" : pct >= 50 ? "bg-amber" : "bg-brick";
              return (
                <li key={k.kind} className={lowConfidence ? "bg-amber/8 -mx-2 px-2 py-1.5 rounded-[3px]" : ""}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-semibold text-ink">{kindLabel(k.kind)}</span>
                      {lowConfidence && (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-amber bg-amber/15 px-1.5 py-0.5 rounded-full">
                          model attention
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] text-ink tabular-nums font-semibold">
                      {k.autoExtracted}/{k.count} <span className="text-graphite font-medium">· {pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-2 bg-paper rounded-full overflow-hidden" style={{ background: "#E8E2D5" }}>
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="bg-paper rounded-[4px] px-4 py-3">
      <p className={`text-[24px] font-bold tabular-nums leading-none ${accent}`}>{value}</p>
      <p className="text-[13px] font-semibold text-ink mt-2">{label}</p>
      <p className="text-[12px] text-graphite mt-0.5">{sub}</p>
    </div>
  );
}
