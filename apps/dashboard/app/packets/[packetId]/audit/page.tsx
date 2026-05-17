import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClientFromCookies } from "../../../../lib/supabase";
import { formatDateTime, shortId } from "../../../../lib/format";

type AuditRow = {
  audit_id: string;
  packet_id: string | null;
  applicant_id: string | null;
  actor_kind: string;
  actor_id: string | null;
  table_name: string;
  row_id: string;
  operation: string;
  changed_columns: string[] | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  request_id: string | null;
  occurred_at: string;
};

const OP_STYLE: Record<string, string> = {
  INSERT: "bg-teal/15 text-teal",
  UPDATE: "bg-amber/15 text-amber",
  DELETE: "bg-brick/15 text-brick",
};

export default async function AuditPage({ params }: { params: Promise<{ packetId: string }> }) {
  const { packetId } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const [packetRes, auditRes] = await Promise.all([
    supabase
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, status")
      .eq("packet_id", packetId)
      .is("deleted_at", null)
      .single(),
    supabase
      .schema("snap_enrollment")
      .from("audit_log_events")
      .select("*")
      .eq("packet_id", packetId)
      .order("occurred_at", { ascending: false })
      .limit(500),
  ]);

  if (!packetRes.data) notFound();
  const events = (auditRes.data ?? []) as AuditRow[];

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-surface border-b border-hairline px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href={`/packets/${packetId}`} className="text-[13px] font-semibold text-brick hover:underline">
            ← Packet
          </Link>
          <span className="text-hairline">·</span>
          <span className="text-[12px] font-mono tabular-nums text-muted">{shortId(packetId)}</span>
          <span className="text-hairline">·</span>
          <span className="text-[12px] uppercase tracking-wider font-semibold text-muted">Audit log</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Audit trail</h1>
          <p className="text-[14px] text-graphite mt-1">
            Every state-changing action on this packet. PII columns are redacted in the diff view.
            Most-recent first; capped at 500 events.
          </p>
        </div>

        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          {events.length === 0 ? (
            <p className="text-[14px] text-muted italic">No audit events recorded for this packet.</p>
          ) : (
            <ol className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.audit_id}
                  className="flex items-start gap-3 rounded border border-hairline bg-paper px-3 py-2.5 text-[13px]"
                >
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      OP_STYLE[e.operation] ?? "bg-graphite/10 text-graphite"
                    }`}
                  >
                    {e.operation}
                  </span>
                  <span className="shrink-0 rounded bg-graphite/10 px-1.5 py-0.5 font-mono text-[10px] text-graphite">
                    {e.table_name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-ink">
                      {summarize(e)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      actor: <span className="font-mono">{e.actor_kind}</span>
                      {e.actor_id && <span className="font-mono"> · {shortId(e.actor_id)}</span>}
                      {e.request_id && <span className="font-mono"> · req={shortId(e.request_id)}</span>}
                      <span className="ml-2 tabular-nums">{formatDateTime(e.occurred_at)}</span>
                    </div>
                    {e.changed_columns && e.changed_columns.length > 0 && (
                      <details className="mt-1 text-[11px]">
                        <summary className="cursor-pointer text-muted hover:text-graphite">
                          changes: {e.changed_columns.join(", ")}
                        </summary>
                        <pre className="mt-1 overflow-x-auto bg-graphite/5 p-2 rounded font-mono text-[10px]">
{JSON.stringify({ before: e.old_values, after: e.new_values }, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function summarize(e: AuditRow): string {
  const table = e.table_name.replace(/^snap_enrollment\./, "");
  if (e.operation === "INSERT") return `${table} created`;
  if (e.operation === "DELETE") return `${table} deleted`;
  const cols = e.changed_columns ?? [];
  if (cols.length === 0) return `${table} updated`;
  // Highlight a status column transition when present
  if (cols.includes("status") && e.old_values && e.new_values) {
    const prev = (e.old_values as { status?: string }).status ?? "?";
    const next = (e.new_values as { status?: string }).status ?? "?";
    return `${table} status: ${prev} → ${next}`;
  }
  return `${table} updated (${cols.length} column${cols.length === 1 ? "" : "s"})`;
}
