"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DocumentChecklistItem } from "@/components/snap/DocumentChecklistItem";
import { ProgressBar } from "@/components/snap/ProgressBar";
import type { components } from "@/lib/api/types";

type DocumentItem = components["schemas"]["DocumentItem"];

type Props = {
  packetId: string;
  initialItems: DocumentItem[];
};

export function DocumentChecklist({ packetId, initialItems }: Props) {
  const t = useTranslations("documents");
  const [items, setItems] = useState(initialItems);

  const required = items.filter((i) => i.required);
  const uploaded = required.filter(
    (i) =>
      i.status === "Uploaded" ||
      i.status === "Accepted for Packet" ||
      i.status === "Needs Review"
  );

  function handleUploaded(documentId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === documentId ? { ...item, status: "Uploaded" as const } : item
      )
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall doc progress */}
      <ProgressBar
        completed={uploaded.length}
        total={required.length}
        label={t("progressLabel", { uploaded: uploaded.length, total: required.length })}
      />

      {items.length === 0 ? (
        <p className="text-slate-500">No documents required for your packet.</p>
      ) : (
        <ul className="space-y-3" aria-label={t("title")}>
          {items.map((item) => (
            <DocumentChecklistItem
              key={item.id}
              item={item}
              packetId={packetId}
              onUploaded={handleUploaded}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
