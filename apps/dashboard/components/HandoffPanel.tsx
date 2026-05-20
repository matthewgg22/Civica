"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";
import { formatDateTime, shortId } from "../lib/format";

interface ExportRow {
  export_id: string;
  format: string;
  storage_path: string | null;
  checksum_sha256: string | null;
  agency_reference: string | null;
  exported_at: string;
}

interface Props {
  packetId: string;
  packetStatus: string;
  blockerCount: number;
}

const EXPORT_FORMATS = [
  { value: "json_api" as const, label: "JSON (structured)", impl: true },
  { value: "csv_summary" as const, label: "CSV summary", impl: true },
  { value: "pdf_packet" as const, label: "PDF packet", impl: true },
  { value: "xml_ecs" as const, label: "SNAP ECS XML", impl: false },
] as const;

const ALLOWED_STATUSES = new Set(["Ready for Handoff", "Handed Off"]);

// Formats that produce downloadable storage artifacts
const DOWNLOADABLE_FORMATS = new Set(["json_api", "csv_summary", "pdf_packet"]);

export default function HandoffPanel({ packetId, packetStatus, blockerCount }: Props) {
  const router = useRouter();
  const [history, setHistory] = useState<ExportRow[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // tracks which format is in flight
  const [error, setError] = useState<string | null>(null);
  const [agencyRef, setAgencyRef] = useState("");
  const [statusAllowed, setStatusAllowed] = useState(ALLOWED_STATUSES.has(packetStatus));

  useEffect(() => {
    setStatusAllowed(ALLOWED_STATUSES.has(packetStatus));
  }, [packetStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const rows = await api.handoff.list(session.access_token, packetId);
        if (!cancelled) setHistory(rows as ExportRow[]);
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [packetId]);

  async function exportPacket(format: "json_api" | "csv_summary" | "pdf_packet") {
    setLoading(format);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      if (format === "pdf_packet") {
        await api.handoffPdf.create(session.access_token, packetId, {
          agency_reference: agencyRef || undefined,
        });
      } else {
        await api.handoff.create(session.access_token, packetId, {
          format,
          agency_reference: agencyRef || undefined,
        });
      }

      setAgencyRef("");
      const rows = await api.handoff.list(session.access_token, packetId);
      setHistory(rows as ExportRow[]);
      if (format === "pdf_packet") {
        toast.success("PDF ready — download below");
      } else {
        toast.success(`Export ready (${formatLabel(format)}) — download below`);
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to export";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  async function downloadExport(exportId: string) {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { url } = (await api.handoff.download(
        session.access_token,
        packetId,
        exportId,
      )) as { url: string };
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  const canExport = statusAllowed && blockerCount === 0;
  const disabledReason = !statusAllowed
    ? `Packet must be in "Ready for Handoff" status (current: ${packetStatus})`
    : blockerCount > 0
      ? "Resolve all readiness blockers above before exporting"
      : "";

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-graphite italic leading-snug">
        Civica does not determine SNAP eligibility or approve benefits. This export organizes the
        packet for review through official SNAP channels.
      </p>

      <div className="space-y-2">
        <label className="block">
          <span className="text-[12px] uppercase tracking-wider font-semibold text-muted">
            Agency reference (optional)
          </span>
          <input
            type="text"
            placeholder="Intake / confirmation number from the agency"
            value={agencyRef}
            onChange={(e) => setAgencyRef(e.target.value)}
            className="mt-1 w-full border border-hairline rounded-[3px] px-3 py-2 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white transition-colors"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {EXPORT_FORMATS.filter((f) => f.impl).map((f) => {
            const isActive = loading === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => exportPacket(f.value as "json_api" | "csv_summary" | "pdf_packet")}
                disabled={!canExport || loading !== null}
                title={disabledReason || undefined}
                className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 disabled:bg-graphite/20 disabled:text-graphite disabled:cursor-not-allowed transition-colors"
              >
                {isActive ? "Exporting…" : `Export packet (${formatLabel(f.value)})`}
              </button>
            );
          })}
          {/* xml_ecs stays disabled — state-agency ECS schema is its own project */}
          <button
            type="button"
            disabled
            title="SNAP ECS XML — coming in a future release"
            className="px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-graphite/10 text-muted cursor-not-allowed"
          >
            SNAP ECS XML · soon
          </button>
        </div>

        {!canExport && disabledReason && (
          <p className="text-[12px] text-amber">{disabledReason}</p>
        )}
        {error && <p className="text-[13px] text-error">{error}</p>}
      </div>

      <div>
        <h3 className="text-[12px] uppercase tracking-wider font-semibold text-muted mb-2">
          Prior exports {history && `(${history.length})`}
        </h3>
        {history === null ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-[13px] text-muted italic">No exports yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {history.map((row) => (
              <li key={row.export_id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">
                    {formatLabel(row.format)}
                    {row.agency_reference && (
                      <span className="ml-2 font-mono text-[12px] text-graphite">
                        · {row.agency_reference}
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted">
                    {formatDateTime(row.exported_at)} ·{" "}
                    <span className="font-mono">{shortId(row.export_id)}</span>
                    {row.checksum_sha256 && (
                      <span className="ml-2 font-mono" title={row.checksum_sha256}>
                        sha256:{row.checksum_sha256.slice(0, 8)}…
                      </span>
                    )}
                  </p>
                </div>
                {DOWNLOADABLE_FORMATS.has(row.format) && (
                  <button
                    type="button"
                    onClick={() => downloadExport(row.export_id)}
                    className="text-[13px] font-semibold text-pine hover:underline shrink-0"
                  >
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatLabel(format: string): string {
  switch (format) {
    case "json_api":
      return "JSON";
    case "csv_summary":
      return "CSV";
    case "pdf_packet":
      return "PDF";
    case "xml_ecs":
      return "ECS XML";
    default:
      return format;
  }
}
