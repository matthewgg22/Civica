"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentUploader } from "./DocumentUploader";
import { resolveInboxItem } from "@/lib/api/actions";
import type { components } from "@/lib/api/types";

type InboxItem = components["schemas"]["InboxItem"];

type CardState = "pending" | "uploading" | "resolved";

type Props = {
  item: InboxItem;
  onResolved: (id: string) => void;
};

export function InboxItemCard({ item, onResolved }: Props) {
  const t = useTranslations("inbox");
  const [cardState, setCardState] = useState<CardState>(
    item.resolved ? "resolved" : "pending"
  );
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const uploadControlsId = `inbox-upload-${item.id}`;

  function handleUploadSuccess() {
    startTransition(async () => {
      const result = await resolveInboxItem(item.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCardState("resolved");
      setExpanded(false);
      onResolved(item.id);
    });
  }

  function handleManualResolve() {
    startTransition(async () => {
      const result = await resolveInboxItem(item.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCardState("resolved");
      onResolved(item.id);
    });
  }

  const isResolved = cardState === "resolved";

  return (
    <li
      className={[
        "rounded-xl border bg-white motion-safe:transition-opacity",
        isResolved ? "border-green-200 opacity-60" : "border-slate-200",
      ].join(" ")}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {isResolved && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <span aria-hidden="true">✓</span> Resolved
              </span>
            )}
            <p className="text-sm font-medium leading-relaxed">{item.prompt}</p>
            {item.created_at && (
              <p className="text-xs text-slate-500">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {!isResolved && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={uploadControlsId}
              className="shrink-0"
            >
              {t("uploadResponse")}
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription aria-live="polite">{error}</AlertDescription>
          </Alert>
        )}

        {/* Expandable uploader */}
        {expanded && !isResolved && (
          <div
            id={uploadControlsId}
            className="border-t border-slate-100 pt-3 space-y-3"
          >
            {/* The inbox upload proxy uses /api/inbox/:requestId/upload,
                but DocumentUploader targets /api/upload/:packetId/:documentId.
                We use a thin inline uploader here instead. */}
            <InboxUploader requestId={item.id} onSuccess={handleUploadSuccess} />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualResolve}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "…" : t("markResolved")}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// ── Inline uploader specific to inbox ────────────────────────────────────────

type InboxUploaderProps = {
  requestId: string;
  onSuccess: () => void;
};

function InboxUploader({ requestId, onSuccess }: InboxUploaderProps) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [percent, setPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  async function upload(file: File) {
    setUploadState("uploading");
    setPercent(0);

    const formData = new FormData();
    formData.append("file", file);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setPercent(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        xhr.status < 300 ? resolve() : reject(new Error(t("uploadError")));
      });
      xhr.addEventListener("error", () => reject(new Error(t("uploadError"))));
      xhr.open("POST", `/api/inbox/${encodeURIComponent(requestId)}/upload`);
      xhr.send(formData);
    })
      .then(() => {
        setUploadState("done");
        onSuccess();
      })
      .catch((e: Error) => {
        setUploadState("error");
        setErrorMsg(e.message);
      });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }

  if (uploadState === "uploading") {
    return (
      <div aria-live="polite" className="space-y-1">
        <p className="text-sm text-slate-600">{t("uploadProgress", { percent })}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 motion-safe:transition-all"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    );
  }

  if (uploadState === "error") {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-red-600">{errorMsg}</p>
        <Button variant="outline" size="sm" onClick={() => setUploadState("idle")}>
          {tc("tryAgain")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <label className="flex-1">
        <span className="sr-only">{t("cameraCapture")}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleChange}
        />
        <span className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900">
          📷 {t("cameraCapture")}
        </span>
      </label>
      <label className="flex-1">
        <span className="sr-only">{t("filePicker")}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={handleChange}
        />
        <span className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900">
          📁 {t("filePicker")}
        </span>
      </label>
    </div>
  );
}
