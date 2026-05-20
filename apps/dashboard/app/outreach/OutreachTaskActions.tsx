"use client";

import { useTransition } from "react";
import { updateOutreachTaskStatus } from "./actions";

type Props = {
  taskId: string;
};

export function OutreachTaskActions({ taskId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleUpdate(status: "contacted" | "resolved" | "cancelled") {
    startTransition(async () => {
      await updateOutreachTaskStatus(
        taskId,
        status,
        status === "resolved" ? "Resolved via navigator outreach." : undefined,
      );
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => handleUpdate("contacted")}
        disabled={isPending}
        className="text-[12px] font-semibold px-3 py-1.5 rounded-[4px] bg-pine/10 text-pine hover:bg-pine/20 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? "…" : "Contacted"}
      </button>
      <button
        onClick={() => handleUpdate("resolved")}
        disabled={isPending}
        className="text-[12px] font-semibold px-3 py-1.5 rounded-[4px] bg-surface text-graphite border border-hairline hover:bg-surface/80 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? "…" : "Resolve"}
      </button>
    </div>
  );
}
