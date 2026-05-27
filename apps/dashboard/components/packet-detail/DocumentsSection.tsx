import React from "react";
import { getDocItems } from "../../lib/packet-fetchers";
import DocumentChecklist from "../DocumentChecklist";
import DocumentGrid from "../DocumentGrid";
import MissingItemRequestPanel from "../MissingItemRequestPanel";

export function DocumentsSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-3 animate-pulse">
      <div className="h-3 w-40 bg-paper rounded" />
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-paper rounded" />
        ))}
      </div>
    </section>
  );
}

type DocRow = {
  document_id: string;
  document_kind: string;
  original_filename: string | null;
  processing_status: string;
  uploaded_at: string;
};

type FieldRow = {
  field_id: string;
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
};

export default async function DocumentsSection({
  packetId,
  applicantId,
  stateCode,
  uploadedDocs,
  fields,
  extractionsByDoc,
}: {
  packetId: string;
  applicantId: string;
  stateCode: string;
  uploadedDocs: DocRow[];
  fields: FieldRow[];
  extractionsByDoc: Record<string, string[]>;
}) {
  const docItems = await getDocItems(packetId);

  const unresolvedItems = (
    docItems as Array<{
      item_id: string;
      label: string;
      document_kind: string;
      resolved_at: string | null;
      waived_at: string | null;
    }>
  ).filter((it) => !it.resolved_at && !it.waived_at);

  return (
    <>
      {/* Required document checklist */}
      <section className="bg-surface border border-hairline rounded-[4px] p-6">
        <div className="mb-5">
          <div className="flex items-baseline gap-2">
            <h2 className="section-title">Required Documents</h2>
            <span className="text-[12px] text-muted tabular-nums">({docItems.length})</span>
          </div>
          <p className="section-sub mt-1 leading-snug">
            Documents needed before handoff. Mark each resolved once received, or waive with a reason.
          </p>
        </div>
        <DocumentChecklist
          packetId={packetId}
          applicantId={applicantId}
          stateCode={stateCode as "CA" | "MA"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items={docItems as any}
          uploadedDocs={uploadedDocs}
        />
      </section>

      {/* Missing-item requests */}
      <section className="bg-surface border border-hairline rounded-[4px] p-6">
        <div className="mb-5">
          <h2 className="section-title">Missing-Item Requests</h2>
          <p className="section-sub mt-1 leading-snug">
            Send a structured request to the applicant for a missing or unclear document.
          </p>
        </div>
        <MissingItemRequestPanel packetId={packetId} unresolvedItems={unresolvedItems} />
      </section>

      {/* Uploaded documents grid */}
      <section className="bg-surface border border-hairline rounded-[4px] p-6">
        <div className="mb-5">
          <div className="flex items-baseline gap-2">
            <h2 className="section-title">Uploaded Documents</h2>
            <span className="text-[12px] text-muted tabular-nums">({uploadedDocs.length})</span>
          </div>
          <p className="section-sub mt-1 leading-snug">
            Click a document to view the original file alongside its extracted fields.
          </p>
        </div>
        {uploadedDocs.length === 0 ? (
          <div className="py-3 px-4 bg-paper border border-dashed border-hairline rounded-[4px] flex items-center gap-3">
            <span className="text-muted text-[16px] shrink-0">○</span>
            <p className="text-[13px] text-graphite leading-snug">
              <span className="font-semibold">No documents uploaded</span>
              <span className="text-muted"> · move packet to &apos;Needs Documents&apos; to request files</span>
            </p>
          </div>
        ) : (
          <DocumentGrid docs={uploadedDocs} fields={fields} extractionsByDoc={extractionsByDoc} />
        )}
      </section>
    </>
  );
}
