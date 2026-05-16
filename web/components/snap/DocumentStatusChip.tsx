import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types";

type DocumentStatus = components["schemas"]["DocumentStatus"];

// icon + label so status is never color-only
const STATUS_CONFIG: Record<
  DocumentStatus,
  { icon: string; bg: string; text: string; border: string }
> = {
  "Not Started": {
    icon: "○",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
  },
  Uploaded: {
    icon: "↑",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  "Needs Review": {
    icon: "⏳",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-300",
  },
  "Accepted for Packet": {
    icon: "✓",
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-300",
  },
  Insufficient: {
    icon: "!",
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-300",
  },
  Missing: {
    icon: "✕",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-300",
  },
  Optional: {
    icon: "◇",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  "N/A": {
    icon: "–",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
  },
};

type Props = { status: DocumentStatus; className?: string };

export function DocumentStatusChip({ status, className }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.bg,
        cfg.text,
        cfg.border,
        className
      )}
      aria-label={`Status: ${status}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {status}
    </span>
  );
}
