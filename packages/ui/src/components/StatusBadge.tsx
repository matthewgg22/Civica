import * as React from "react";
import { cn } from "../lib/utils.js";
import type { PacketStatus, DocumentStatus } from "@civica/snap-enums";

type Status = PacketStatus | DocumentStatus;

const statusStyles: Record<Status, string> = {
  // PacketStatus (8-value sentence-case enum from snap-enums)
  "Draft":                        "bg-gray-100 text-gray-700",
  "Submitted for Review":         "bg-blue-100 text-blue-700",
  "Needs Documents":              "bg-yellow-100 text-yellow-700",
  "Needs Applicant Clarification":"bg-orange-100 text-orange-700",
  "In Navigator Review":          "bg-purple-100 text-purple-700",
  "Ready for Handoff":            "bg-green-100 text-green-700",
  "Handed Off":                   "bg-green-200 text-green-800",
  "Closed":                       "bg-gray-200 text-gray-500",
  // DocumentStatus
  pending:    "bg-gray-100 text-gray-700",
  uploading:  "bg-blue-50 text-blue-600",
  processing: "bg-purple-100 text-purple-700",
  extracted:  "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
  rejected:   "bg-red-200 text-red-800",
};

const statusLabels: Record<Status, string> = {
  // PacketStatus
  "Draft":                        "Draft",
  "Submitted for Review":         "Submitted",
  "Needs Documents":              "Needs Documents",
  "Needs Applicant Clarification":"Needs Clarification",
  "In Navigator Review":          "In Review",
  "Ready for Handoff":            "Ready for Handoff",
  "Handed Off":                   "Handed Off",
  "Closed":                       "Closed",
  // DocumentStatus
  pending:    "Pending",
  uploading:  "Uploading",
  processing: "Processing",
  extracted:  "Extracted",
  failed:     "Failed",
  rejected:   "Not Accepted",
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
