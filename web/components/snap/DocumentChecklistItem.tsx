"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DocumentStatusChip } from "./DocumentStatusChip";
import { DocumentUploader } from "./DocumentUploader";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/types";

type DocumentItem = components["schemas"]["DocumentItem"];
type DocumentStatus = components["schemas"]["DocumentStatus"];

// Statuses that allow (re-)upload
const UPLOADABLE: Set<DocumentStatus> = new Set([
  "Not Started",
  "Insufficient",
  "Missing",
]);

type Props = {
  item: DocumentItem;
  packetId: string;
  onUploaded: (documentId: string) => void;
};

export function DocumentChecklistItem({ item, packetId, onUploaded }: Props) {
  const t = useTranslations("documents");
  const [expanded, setExpanded] = useState(false);
  const [localStatus, setLocalStatus] = useState<DocumentStatus>(item.status);

  const canUpload = UPLOADABLE.has(localStatus);
  const controlsId = `doc-controls-${item.id}`;

  function handleUploaded() {
    setLocalStatus("Uploaded");
    setExpanded(false);
    onUploaded(item.id);
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      {/* Row */}
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.required && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {t("required")}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-slate-500">{item.description}</p>
          )}
          <DocumentStatusChip status={localStatus} className="mt-1" />
        </div>

        {canUpload && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={controlsId}
          >
            {t("upload")}
          </Button>
        )}
      </div>

      {/* Expandable uploader */}
      {expanded && canUpload && (
        <div id={controlsId} className="border-t border-slate-100 p-4">
          <DocumentUploader
            packetId={packetId}
            documentId={item.id}
            onSuccess={handleUploaded}
            compact
          />
        </div>
      )}
    </li>
  );
}
