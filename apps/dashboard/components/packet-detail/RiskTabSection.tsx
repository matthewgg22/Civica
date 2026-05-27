import React from "react";
import RiskScoreHero from "../packet-risk/RiskScoreHero";
import FlowBreakdown from "../packet-risk/FlowBreakdown";
import RecommendedActions from "../packet-risk/RecommendedActions";
import type { RiskFlow, RiskAction } from "../packet-risk/types";
import { formatDate } from "../../lib/format";

export function RiskTabSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {[1, 2, 3].map((i) => (
        <section key={i} className="bg-surface border border-hairline rounded-[4px] p-6">
          <div className="h-3 w-32 bg-paper rounded mb-3" />
          <div className="h-20 bg-paper rounded" />
        </section>
      ))}
    </div>
  );
}

type RiskRow = {
  score: number | null;
  tier: string | null;
  engine_version: string | null;
  created_at: string;
} | null;

export default async function RiskTabSection({
  riskRow,
  riskFlows,
  riskActions,
}: {
  riskRow: RiskRow;
  riskFlows: RiskFlow[];
  riskActions: RiskAction[];
}) {
  return (
    <>
      <RiskScoreHero
        score={riskRow?.score ?? null}
        tier={(riskRow?.tier as "high" | "medium" | "low" | "incomplete") ?? "incomplete"}
        engineVersion={riskRow?.engine_version ?? "v0.2.0"}
        evaluatedAt={riskRow?.created_at ? formatDate(riskRow.created_at) : null}
        flows={riskFlows}
      />
      <FlowBreakdown flows={riskFlows} />
      <RecommendedActions actions={riskActions} currentScore={riskRow?.score ?? null} />
    </>
  );
}
