"use client";

import { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downscaleImage } from "@/lib/storage/imageUtils";
import { cn } from "@/lib/utils";

type UploadState =
  | { phase: "idle" }
  | { phase: "processing" }
  | { phase: "uploading"; percent: number }
  | { phase: "done"; previewUrl: string; fileName: string }
  | { phase: "error"; message: string };

type Props = {
  packetId: string;
  documentId: string;
  onSuccess: () => void;
  compact?: boolean;
};

export function DocumentUploader({ packetId, documentId, onSuccess, compact = false }: Props) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);

  const processAndUpload = useCallback(
    async (file: File) => {
      setState({ phase: "processing" });

      let toUpload: File;
      try {
        toUpload = await downscaleImage(file);
      } catch {
        toUpload = file;
      }

      const formData = new FormData();
      formData.append("file", toUpload);

      setState({ phase: "uploading", percent: 0 });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setState({ phase: "uploading", percent: Math.round((e.loaded / e.total) * 100) });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = t("uploadError");
            try {
              const body = JSON.parse(xhr.responseText);
              if (body.error) msg = body.error;
            } catch { /* ignore */ }
            reject(new Error(msg));
          }
        });

        xhr.addEventListener("error", () => reject(new Error(t("uploadError"))));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open(
          "POST",
          `/api/upload/${encodeURIComponent(packetId)}/${encodeURIComponent(documentId)}`
        );
        xhr.send(formData);
      })
        .then(() => {
          const previewUrl = toUpload.type.startsWith("image/")
            ? URL.createObjectURL(toUpload)
            : "";
          setState({ phase: "done", previewUrl, fileName: toUpload.name });
          toast.success(t("toastUploadSuccess"));
          onSuccess();
        })
        .catch((err: Error) => {
          setState({ phase: "error", message: err.message });
          toast.error(t("toastUploadError"));
        });
    },
    [packetId, documentId, onSuccess, t]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processAndUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  // Drag-and-drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }
  function handleDragLeave() { setIsDragOver(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processAndUpload(file);
  }

  // Keyboard-accessible drop zone
  function handleDropZoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }

  const isUploading = state.phase === "processing" || state.phase === "uploading";

  if (state.phase === "done") {
    return (
      <div className="space-y-2">
        {state.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.previewUrl}
            alt={state.fileName}
            className="max-h-40 rounded-lg object-contain"
          />
        )}
        <p className="text-sm text-green-700">
          ✓ {state.fileName || t("uploadSuccess")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setState({ phase: "idle" })}
        >
          {t("uploadAnother")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />

      {/* Drop zone (desktop) */}
      {!compact && (
        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          aria-label={t("filePicker")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleDropZoneKeyDown}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm text-graphite motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2",
            isDragOver
              ? "border-brick bg-brick/8 text-ink"
              : "border-hairline hover:border-brick/40"
          )}
        >
          <span className="text-2xl" aria-hidden="true">📎</span>
          <span>{t("filePicker")}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className={cn("flex gap-2", compact ? "flex-row" : "flex-col sm:flex-row")}>
        {/* Camera (prominent on mobile) */}
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="flex-1"
          disabled={isUploading}
          onClick={() => cameraInputRef.current?.click()}
          aria-label={t("cameraCapture")}
        >
          📷 {t("cameraCapture")}
        </Button>

        {/* File picker */}
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="flex-1"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("filePicker")}
        >
          📁 {t("filePicker")}
        </Button>
      </div>

      {/* Upload progress */}
      {state.phase === "processing" && (
        <p className="text-sm text-graphite" aria-live="polite">
          {tc("processing")}
        </p>
      )}
      {state.phase === "uploading" && (
        <div className="space-y-1" aria-live="polite">
          <p className="text-sm text-graphite">
            {t("uploadProgress", { percent: state.percent })}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-teal motion-safe:transition-all motion-safe:duration-150"
              style={{ width: `${state.percent}%` }}
              role="progressbar"
              aria-valuenow={state.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {state.phase === "error" && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-red-600">{state.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setState({ phase: "idle" })}
          >
            {tc("tryAgain")}
          </Button>
        </div>
      )}
    </div>
  );
}
