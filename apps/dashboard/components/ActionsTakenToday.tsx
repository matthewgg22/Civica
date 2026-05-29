"use client";

import { useEffect, useState } from "react";
import { ACTION_LOGGED_EVENT, getActionsToday, type LoggedAction } from "../lib/action-log";

// Top-of-page counter that surfaces today's logged navigator actions across
// the cohort. Reads from localStorage on mount (so the count persists across
// /enrollments → /packets → /enrollments navigation) and subscribes to a
// custom DOM event fired by RowActionChip so it updates the moment a chip
// is clicked — no page refresh needed.

export default function ActionsTakenToday() {
  const [actions, setActions] = useState<LoggedAction[]>([]);

  useEffect(() => {
    setActions(getActionsToday());
    const onLogged = () => setActions(getActionsToday());
    window.addEventListener(ACTION_LOGGED_EVENT, onLogged);
    // Cross-tab updates — another /enrollments tab firing a chip should
    // refresh this counter too.
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("civica:actions-today")) onLogged();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ACTION_LOGGED_EVENT, onLogged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (actions.length === 0) {
    // Pre-engagement state — show a quiet hint so the counter is discoverable
    // before the navigator has clicked any chip.
    return (
      <div className="text-[11px] text-graphite uppercase tracking-wider font-semibold">
        no actions logged yet today
      </div>
    );
  }

  const last = actions[actions.length - 1]!;
  return (
    <div className="text-[11px] uppercase tracking-wider font-bold text-pine flex items-center gap-2">
      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-pine text-paper tabular-nums">
        {actions.length}
      </span>
      <span>action{actions.length === 1 ? "" : "s"} logged today</span>
      <span className="text-graphite font-medium normal-case tracking-normal text-[11px]">
        · last: {last.label.toLowerCase()} → {last.applicantName}
      </span>
    </div>
  );
}
