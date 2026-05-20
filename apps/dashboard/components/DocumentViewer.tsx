"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";
import { getDocumentSignedUrl } from "../app/packets/[packetId]/actions";
import { docKindLabel } from "../lib/format";

export interface UploadedDoc {
  document_id: string;
  document_kind: string;
  original_filename: string | null;
  processing_status: string;
  uploaded_at: string;
}

export interface ExtractionFieldRow {
  field_id: string;
  document_id?: string | null;
  extraction_id: string;
  field_key: string;
  field_label: string;
  original_ocr_value: string | null;
  applicant_answer: string | null;
  navigator_confirmed_value: string | null;
  confidence: number;
  needs_review: boolean;
  reviewed_at: string | null;
  review_note: string | null;
}

interface Props {
  /** Document to display, or null to keep the modal closed. */
  doc: UploadedDoc | null;
  /** All extraction fields for the packet — we filter to this doc's extraction. */
  fields: ExtractionFieldRow[];
  /**
   * Map of document_id -> extraction_id list, so we can filter `fields`
   * (which only carries extraction_id) to the rows belonging to `doc`.
   */
  extractionsByDoc: Record<string, string[]>;
  onClose: () => void;
}

// Refresh signed URL when less than this much TTL is left.
const REFRESH_BEFORE_MS = 60_000; // 1 min before the 5-min URL dies

export default function DocumentViewer({ doc, fields, extractionsByDoc, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [locallyReviewed, setLocallyReviewed] = useState<Set<string>>(new Set());

  // Filter the packet-wide fields list to just this doc's extraction(s).
  const docFields = useMemo(() => {
    if (!doc) return [] as ExtractionFieldRow[];
    const extIds = new Set(extractionsByDoc[doc.document_id] ?? []);
    if (extIds.size === 0) return [] as ExtractionFieldRow[];
    return fields.filter((f) => extIds.has(f.extraction_id));
  }, [doc, fields, extractionsByDoc]);

  const isImage = contentType?.startsWith("image/") ?? false;
  const isPdf = contentType === "application/pdf";

  // Fetch signed URL whenever the open doc changes.
  useEffect(() => {
    if (!doc) {
      setSignedUrl(null);
      setContentType(null);
      setUrlError(null);
      setZoom(1);
      return;
    }
    let cancelled = false;
    setUrlLoading(true);
    setUrlError(null);
    setSignedUrl(null);
    getDocumentSignedUrl(doc.document_id)
      .then((res) => {
        if (cancelled) return;
        if (!res) {
          setUrlError("Could not load this document. You may not have access, or the file is missing.");
          return;
        }
        setSignedUrl(res.url);
        setContentType(res.contentType);
        // Schedule refresh before expiry
        const ttl = res.expiresAt - Date.now() - REFRESH_BEFORE_MS;
        if (ttl > 0) {
          const t = setTimeout(() => {
            if (!cancelled) {
              // re-trigger by clearing — effect will not re-run unless dep changes,
              // so call the action directly here:
              getDocumentSignedUrl(doc.document_id).then((r2) => {
                if (cancelled || !r2) return;
                setSignedUrl(r2.url);
              });
            }
          }, ttl);
          return () => clearTimeout(t);
        }
      })
      .catch(() => {
        if (!cancelled) setUrlError("Failed to load document.");
      })
      .finally(() => {
        if (!cancelled) setUrlLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  // ESC closes; trap focus inside dialog.
  useEffect(() => {
    if (!doc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    // Focus the close button on mount so screen readers / keyboard users land here.
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  const saveReview = useCallback(
    async (fieldId: string) => {
      setSaving(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await api.fields.review(session.access_token, fieldId, {
          navigator_confirmed_value: confirmed[fieldId] ?? "",
        });
        setLocallyReviewed((s) => new Set(s).add(fieldId));
        setEditingFieldId(null);
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [confirmed, router],
  );

  if (!doc) return null;

  const fileLabel = doc.original_filename ?? `${doc.document_kind}.bin`;
  const status = doc.processing_status;
  const isStillProcessing = status === "uploaded" || status === "classifying" || status === "extracting";
  const isRejected = status === "rejected";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Document viewer: ${docKindLabel(doc.document_kind)} (${fileLabel})`}
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="document-viewer-modal"
    >
      <div className="bg-surface rounded-[6px] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-hairline shrink-0">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink truncate">{fileLabel}</p>
            <p className="text-[12px] text-muted truncate">
              {docKindLabel(doc.document_kind)}
              <span className="mx-1.5">·</span>
              <span className="uppercase tracking-wider">{status.replace(/_/g, " ")}</span>
            </p>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close document viewer"
            className="text-[20px] text-muted hover:text-ink w-9 h-9 rounded-full hover:bg-paper flex items-center justify-center shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body: image | fields */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Image / preview panel */}
          <div className="flex-1 bg-paper relative flex flex-col min-h-[300px] md:min-h-0 md:border-r border-hairline">
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {urlLoading && (
                <p className="text-muted text-[13px]">Loading preview…</p>
              )}
              {!urlLoading && urlError && (
                <p className="text-brick text-[13px] max-w-sm text-center">{urlError}</p>
              )}
              {!urlLoading && !urlError && signedUrl && isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrl}
                  alt={`${docKindLabel(doc.document_kind)} — ${fileLabel}`}
                  className="max-w-full max-h-full select-none"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.1s ease-out" }}
                  draggable={false}
                />
              )}
              {!urlLoading && !urlError && signedUrl && isPdf && (
                <iframe
                  src={signedUrl}
                  title={`${docKindLabel(doc.document_kind)} — ${fileLabel}`}
                  className="w-full h-full min-h-[400px] border-0"
                />
              )}
              {!urlLoading && !urlError && signedUrl && !isImage && !isPdf && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brick text-[13px] underline"
                >
                  Open file in new tab
                </a>
              )}
            </div>

            {/* Zoom controls — images only */}
            {isImage && signedUrl && (
              <div className="border-t border-hairline px-4 py-2 flex items-center gap-3 text-[12px] text-graphite shrink-0">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                  className="px-2 py-0.5 rounded-[3px] border border-hairline hover:bg-surface"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1"
                  aria-label="Zoom level"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                  className="px-2 py-0.5 rounded-[3px] border border-hairline hover:bg-surface"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="tabular-nums text-muted w-12 text-right">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="text-muted hover:text-ink"
                >
                  reset
                </button>
              </div>
            )}
          </div>

          {/* Fields panel */}
          <div className="w-full md:w-[360px] shrink-0 overflow-y-auto p-5">
            <p className="eyebrow mb-3">Extracted fields</p>

            {isStillProcessing ? (
              <EmptyPanel
                title="Still processing"
                body="OCR is still extracting fields from this document."
                action={
                  <button
                    onClick={() => router.refresh()}
                    className="text-[13px] font-medium text-brick hover:underline"
                  >
                    Refresh
                  </button>
                }
              />
            ) : isRejected ? (
              <EmptyPanel
                title="OCR failed"
                body="This document could not be processed. Ask the applicant to re-upload."
              />
            ) : docFields.length === 0 ? (
              <EmptyPanel
                title="No fields extracted"
                body="The OCR pipeline ran but produced no structured fields for this document."
              />
            ) : (
              <ul className="space-y-4">
                {docFields.map((f) => {
                  const isReviewed = locallyReviewed.has(f.field_id) || !!f.reviewed_at;
                  const isLow = f.confidence < 0.85;
                  return (
                    <li
                      key={f.field_id}
                      className={`rounded-[4px] border ${isLow && !isReviewed ? "border-amber/40 bg-amber/5" : "border-hairline bg-surface"} p-3`}
                      data-testid={`field-row-${f.field_id}`}
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <p className="text-[13px] font-semibold text-ink">{f.field_label}</p>
                        <ConfidencePill confidence={f.confidence} needsReview={isLow && !isReviewed} />
                      </div>

                      <div className="space-y-1.5 text-[13px] mb-3">
                        <ValueRow label="OCR" value={f.original_ocr_value} />
                        <ValueRow label="Applicant" value={f.applicant_answer} />
                        <ValueRow
                          label="Confirmed"
                          value={
                            isReviewed
                              ? (confirmed[f.field_id] ?? f.navigator_confirmed_value ?? "—")
                              : null
                          }
                          confirmedStyle
                        />
                      </div>

                      {editingFieldId === f.field_id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            aria-label={`Confirmed value for ${f.field_label}`}
                            value={confirmed[f.field_id] ?? ""}
                            onChange={(e) =>
                              setConfirmed((c) => ({ ...c, [f.field_id]: e.target.value }))
                            }
                            className="w-full border border-hairline rounded-[3px] px-2 py-1 text-[13px] focus:outline-none focus:border-brick"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveReview(f.field_id)}
                              disabled={saving}
                              aria-label={`Save ${f.field_label}`}
                              className="px-3 py-1 text-[12px] font-medium bg-brick text-white rounded-[3px] hover:opacity-90 disabled:opacity-50"
                            >
                              {saving ? "…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingFieldId(null)}
                              className="px-3 py-1 text-[12px] border border-hairline rounded-[3px] hover:bg-paper"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        !isReviewed && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingFieldId(f.field_id);
                                setConfirmed((c) => ({
                                  ...c,
                                  [f.field_id]:
                                    f.applicant_answer ?? f.original_ocr_value ?? "",
                                }));
                              }}
                              aria-label={`Confirm ${f.field_label}`}
                              className="text-[12px] font-medium text-brick hover:underline"
                            >
                              Confirm / Edit →
                            </button>
                          </div>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidencePill({ confidence, needsReview }: { confidence: number; needsReview: boolean }) {
  const pct = Math.round(confidence * 100);
  const cls = confidence >= 0.85
    ? "bg-teal/10 text-teal"
    : confidence >= 0.6
      ? "bg-amber/15 text-amber"
      : "bg-brick/10 text-brick";
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls} tabular-nums`}>
        {pct}%
      </span>
      {needsReview && (
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber" aria-label="Needs review">
          REVIEW
        </span>
      )}
    </div>
  );
}

function ValueRow({ label, value, confirmedStyle }: { label: string; value: string | null; confirmedStyle?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted font-semibold w-16 shrink-0">{label}</span>
      {value ? (
        <span className={confirmedStyle ? "text-teal font-semibold" : "text-ink"}>{value}</span>
      ) : (
        <span className="text-muted italic">{confirmedStyle ? "pending" : "—"}</span>
      )}
    </div>
  );
}

function EmptyPanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="py-4 px-3 bg-paper border border-dashed border-hairline rounded-[4px]">
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      <p className="text-[12px] text-graphite mt-1 leading-snug">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
