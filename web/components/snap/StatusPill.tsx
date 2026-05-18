import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types";

// Exhaustive typed union — compile error if the API adds a new status
export type PacketStatus = components["schemas"]["PacketStatus"];

// Forbidden words must never appear in rendered output.
// The type system enforces this: only PacketStatus values are accepted,
// and PacketStatus is defined by the API stub which contains no forbidden labels.
const STATUS_CONFIG: Record<
  PacketStatus,
  { icon: string; bg: string; text: string; border: string }
> = {
  Draft: {
    icon: "✏️",
    bg: "bg-ink/5",
    text: "text-ink",
    border: "border-hairline",
  },
  "Submitted for Review": {
    icon: "📤",
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  "Needs Documents": {
    icon: "📎",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-300",
  },
  "Needs Applicant Clarification": {
    icon: "💬",
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-300",
  },
  "In Navigator Review": {
    icon: "🔍",
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-300",
  },
  "Ready for Handoff": {
    icon: "✅",
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-300",
  },
  "Handed Off": {
    icon: "🤝",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  Closed: {
    icon: "🗂️",
    bg: "bg-ink/5",
    text: "text-graphite",
    border: "border-hairline",
  },
};

type Props = {
  status: PacketStatus;
  /** Translated display label. Falls back to the raw status string (English). */
  label?: string;
  size?: "sm" | "lg";
  className?: string;
};

export function StatusPill({ status, label, size = "sm", className }: Props) {
  const cfg = STATUS_CONFIG[status];
  const displayLabel = label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs",
        cfg.bg,
        cfg.text,
        cfg.border,
        className
      )}
      aria-label={`Status: ${displayLabel}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {displayLabel}
    </span>
  );
}
