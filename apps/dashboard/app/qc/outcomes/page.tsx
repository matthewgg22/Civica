export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../../lib/supabase";
import AppHeader from "../../../components/AppHeader";
import { formatDateTime, firstNameLastInitial, decryptDemoName, shortId } from "../../../lib/format";
import { LogOutcomeButton } from "./LogOutcomeButton";

const ERROR_TYPE_LABELS: Record<string, string> = {
  income_mismatch:    "Income mismatch",
  sua_overclaim:      "SUA overclaim",
  address_invalid:    "Address invalid",
  missing_doc:        "Missing document",
  heap_sua_conflict:  "HEAP/SUA conflict",
  other:              "Other",
};

export default async function QcOutcomesPage() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: outcomesRaw, error } = await supabase.schema("snap_enrollment").from("qc_outcomes" as any)
    .select("qc_outcome_id, packet_id, qc_sampled, error_found, error_type, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Fetch packets handed off (eligible for QC sampling)
  const { data: handedOffRaw } = await supabase.schema("snap_enrollment").from("snap_packets")
    .select("packet_id, status, county, state_code, handed_off_at, applicants(full_name_ciphertext)")
    .in("status", ["Handed Off", "Closed"])
    .is("deleted_at", null)
    .order("handed_off_at", { ascending: false })
    .limit(100);

  type OutcomeRow = {
    qc_outcome_id: string;
    packet_id: string;
    qc_sampled: boolean;
    error_found: boolean | null;
    error_type: string | null;
    notes: string | null;
    created_at: string;
  };
  type PacketRow = {
    packet_id: string;
    status: string;
    county: string | null;
    state_code: string;
    handed_off_at: string | null;
    applicants: { full_name_ciphertext: string | null } | null;
  };

  const outcomes = (outcomesRaw ?? []) as unknown as OutcomeRow[];
  const handedOff = (handedOffRaw ?? []) as unknown as PacketRow[];

  const sampledIds = new Set(outcomes.map((o) => o.packet_id));
  const unsampledPackets = handedOff.filter((p) => !sampledIds.has(p.packet_id));

  const errorCount = outcomes.filter((o) => o.error_found).length;
  const sampledCount = outcomes.length;
  const baselineRate = sampledCount >= 30 ? ((errorCount / sampledCount) * 100).toFixed(1) : null;

  return (
    <div className="min-h-screen">
      <AppHeader email={user?.email} active="qc" />

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/qc" className="text-[13px] text-muted hover:text-ink transition-colors">← QC Dashboard</Link>
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">QC Outcomes</h1>
          <p className="text-[14px] text-muted mt-1">Log post-handoff case review results · role: CDSS or county staff only</p>
        </div>

        {error && (
          <div className="bg-brick/10 border border-brick/30 text-brick rounded-[4px] p-4 text-[13px]">
            {error.message}
          </div>
        )}

        {/* Baseline progress */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <h2 className="section-title mb-1">Baseline Progress</h2>
          <div className="flex items-center gap-3 mt-4">
            <div className="h-2.5 flex-1 bg-paper rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${sampledCount >= 30 ? "bg-teal" : "bg-graphite/40"}`}
                style={{ width: `${Math.min(100, (sampledCount / 30) * 100)}%` }}
              />
            </div>
            <span className="text-[13px] tabular-nums text-graphite shrink-0">{sampledCount}/30</span>
          </div>
          {baselineRate !== null && (
            <p className="text-[13px] text-ink mt-3">
              Observed error rate: <span className="font-semibold text-brick">{baselineRate}%</span>
              <span className="text-muted ml-2">({errorCount} errors in {sampledCount} packets)</span>
            </p>
          )}
        </section>

        {/* Packets pending QC sampling */}
        {unsampledPackets.length > 0 && (
          <section className="bg-surface border border-hairline rounded-[4px] p-6">
            <h2 className="section-title mb-1">Handed-Off Packets — Awaiting QC Sample</h2>
            <p className="section-sub mb-4">{unsampledPackets.length} packets not yet sampled</p>

            <div className="bg-paper border border-hairline rounded-[4px] overflow-hidden">
              {unsampledPackets.map((packet, i) => {
                const name = packet.applicants
                  ? firstNameLastInitial(decryptDemoName(packet.applicants.full_name_ciphertext))
                  : "—";
                return (
                  <div
                    key={packet.packet_id}
                    className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? "border-t border-hairline" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[14px] font-semibold text-ink">{name}</p>
                        <p className="text-[13px] text-graphite">{packet.county ?? "—"}, {packet.state_code}</p>
                        <span className="text-[11px] text-muted font-mono">{shortId(packet.packet_id)}</span>
                      </div>
                      {packet.handed_off_at && (
                        <p className="text-[12px] text-muted mt-0.5">Handed off {formatDateTime(packet.handed_off_at)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/packets/${packet.packet_id}`}
                        className="text-[13px] text-teal font-semibold hover:underline"
                      >
                        Review →
                      </Link>
                      <LogOutcomeButton packetId={packet.packet_id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Logged outcomes */}
        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <h2 className="section-title mb-1">Logged Outcomes</h2>
          <p className="section-sub mb-4">{sampledCount} cases reviewed</p>

          {outcomes.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[15px] font-medium text-graphite">No outcomes logged yet</p>
              <p className="text-[13px] mt-1.5 text-muted">Use the list above to log results for handed-off packets.</p>
            </div>
          ) : (
            <div className="bg-paper border border-hairline rounded-[4px] overflow-hidden">
              {outcomes.map((outcome, i) => (
                <div
                  key={outcome.qc_outcome_id}
                  className={`flex items-start gap-4 px-5 py-3 ${i > 0 ? "border-t border-hairline" : ""}`}
                >
                  <span
                    className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                      outcome.error_found ? "bg-brick" : "bg-teal"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-ink">
                        {outcome.error_found ? "Error found" : "No error"}
                      </span>
                      {outcome.error_type && (
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-graphite bg-paper border border-hairline px-2 py-0.5 rounded-full">
                          {ERROR_TYPE_LABELS[outcome.error_type] ?? outcome.error_type}
                        </span>
                      )}
                      <Link href={`/packets/${outcome.packet_id}`} className="text-[11px] text-muted font-mono hover:text-ink">
                        {shortId(outcome.packet_id)}
                      </Link>
                    </div>
                    {outcome.notes && (
                      <p className="text-[12px] text-muted italic mt-0.5">&ldquo;{outcome.notes}&rdquo;</p>
                    )}
                  </div>
                  <span className="text-[12px] text-muted tabular-nums shrink-0 mt-0.5">
                    {formatDateTime(outcome.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
