"use client";

import * as React from "react";
import { cn } from "../lib/utils.js";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  maxSizeMb?: number;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function FileDropzone({
  onFiles,
  accept = "image/*,application/pdf",
  maxSizeMb = 10,
  className,
  disabled,
  children,
}: FileDropzoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const maxBytes = maxSizeMb * 1024 * 1024;

  function handle(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter((f) => f.size <= maxBytes);
    if (valid.length) onFiles(valid);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        onChange={(e) => handle(e.target.files)}
        disabled={disabled}
      />
      {children ?? (
        <p className="text-sm text-muted-foreground">
          Drag files here or click to upload (max {maxSizeMb} MB)
        </p>
      )}
    </div>
  );
}
