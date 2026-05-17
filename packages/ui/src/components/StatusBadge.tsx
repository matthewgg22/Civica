import * as React from "react";
import { cn } from "../lib/utils.js";
import type { PacketStatus } from "@civica/types";
import type { DocumentStatus } from "@civica/snap-enums";

type Status = PacketStatus | DocumentStatus;

const statusStyles: Record<Status, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  ready_for_review: "bg-yellow-100 text-yellow-700",
  submitted: "bg-green-100 text-green-700",
  archived: "bg-gray-200 text-gray-500",
  pending: "bg-gray-100 text-gray-700",
  uploading: "bg-blue-50 text-blue-600",
  processing: "bg-purple-100 text-purple-700",
  extracted: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  rejected: "bg-red-200 text-red-800",
};

const statusLabels: Record<Status, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  ready_for_review: "Ready for Review",
  submitted: "Submitted",
  archived: "Archived",
  pending: "Pending",
  uploading: "Uploading",
  processing: "Processing",
  extracted: "Extracted",
  failed: "Failed",
  rejected: "Not Accepted",
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status], className)}
      {...props}
    >
      {statusLabels[status]}
    </span>
  );
}
