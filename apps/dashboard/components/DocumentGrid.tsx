"use client";

import { useEffect, useState } from "react";
import DocumentViewer, { type UploadedDoc, type ExtractionFieldRow } from "./DocumentViewer";
import { getDocumentSignedUrl } from "../app/packets/[packetId]/actions";
import { docKindLabel, shortId } from "../lib/format";

interface Props {
  docs: UploadedDoc[];
  fields: ExtractionFieldRow[];
  /** document_id -> extraction_id list, so the viewer can filter `fields`. */
  extractionsByDoc: Record<string, string[]>;
}

export default function DocumentGrid({ docs, fields, extractionsByDoc }: Props) {
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const openDoc = openDocId ? docs.find((d) => d.document_id === openDocId) ?? null : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {docs.map((doc) => (
          <DocCard
            key={doc.document_id}
            doc={doc}
            onOpen={() => setOpenDocId(doc.document_id)}
            fieldCount={
              (extractionsByDoc[doc.document_id] ?? []).reduce((acc, extId) => {
                return acc + fields.filter((f) => f.extraction_id === extId).length;
              }, 0)
            }
          />
        ))}
      </div>

      <DocumentViewer
        doc={openDoc}
        fields={fields}
        extractionsByDoc={extractionsByDoc}
        onClose={() => setOpenDocId(null)}
      />
    </>
  );
}

function DocCard({
  doc,
  onOpen,
  fieldCount,
}: {
  doc: UploadedDoc;
  onOpen: () => void;
  fieldCount: number;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocumentSignedUrl(doc.document_id)
      .then((res) => {
        if (cancelled || !res) return;
        const ct = res.contentType ?? "";
        if (ct.startsWith("image/")) {
          setThumbUrl(res.url);
        } else if (ct === "application/pdf") {
          setIsPdf(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.document_id]);

  const status = doc.processing_status;
  const statusClass =
    status === "confirmed"
      ? "bg-teal/10 text-teal"
      : status === "rejected"
        ? "bg-brick/10 text-brick"
        : status === "awaiting_confirmation"
          ? "bg-amber/15 text-amber"
          : "bg-paper text-graphite border border-hairline";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${docKindLabel(doc.document_kind)} (${doc.original_filename ?? shortId(doc.document_id)})`}
      data-testid={`doc-card-${doc.document_id}`}
      className="group text-left bg-surface border border-hairline rounded-[4px] overflow-hidden hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-pine"
    >
      {/* Thumbnail (200x260) */}
      <div className="aspect-[10/13] bg-paper relative flex items-center justify-center overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : isPdf ? (
          <PdfIcon />
        ) : loaded ? (
          <GenericIcon kind={doc.document_kind} />
        ) : (
          <div className="text-graphite text-[11px]">…</div>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <p className="text-[13px] font-semibold text-ink leading-snug truncate">
          {docKindLabel(doc.document_kind)}
        </p>
        <p className="text-[11px] text-graphite truncate" title={doc.original_filename ?? undefined}>
          {doc.original_filename ?? shortId(doc.document_id)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusClass}`}>
            {status.replace(/_/g, " ")}
          </span>
          {fieldCount > 0 && (
            <span className="text-[11px] text-graphite tabular-nums">{fieldCount} field{fieldCount === 1 ? "" : "s"}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12 text-brick" aria-hidden>
      <path
        fill="currentColor"
        d="M30 4H10a2 2 0 0 0-2 2v36a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V14L30 4z"
        opacity="0.15"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M30 4H10a2 2 0 0 0-2 2v36a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V14L30 4z"
      />
      <text x="24" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">PDF</text>
    </svg>
  );
}

function GenericIcon({ kind }: { kind: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-muted">
      <svg viewBox="0 0 48 48" className="w-10 h-10 opacity-50" aria-hidden>
        <rect x="8" y="6" width="32" height="36" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="14" y1="16" x2="34" y2="16" stroke="currentColor" strokeWidth="2" />
        <line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" strokeWidth="2" />
        <line x1="14" y1="32" x2="26" y2="32" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="text-[10px] uppercase tracking-wider mt-1">{kind}</p>
    </div>
  );
}
