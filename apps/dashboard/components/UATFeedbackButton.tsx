"use client";

import { usePathname } from "next/navigation";
import { useState, useRef } from "react";

type State = "idle" | "open" | "sending" | "sent" | "error";

export default function UATFeedbackButton() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function open() {
    setState("open");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function close() {
    setState("idle");
    setMessage("");
  }

  async function submit() {
    if (!message.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/uat-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_path: pathname, message }),
      });
      setState(res.ok ? "sent" : "error");
      if (res.ok) setMessage("");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button
        onClick={open}
        className="text-[12px] font-semibold text-teal hover:underline focus:outline-none"
      >
        Send UAT feedback
      </button>

      {state !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send UAT feedback"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={close}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-md bg-surface border border-hairline rounded-[4px] shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink">UAT Feedback</h2>
              <button
                onClick={close}
                className="text-graphite hover:text-ink text-[18px] leading-none focus:outline-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-[12px] text-graphite">
              Page: <span className="font-mono text-ink">{pathname}</span>
            </p>

            {state === "sent" ? (
              <div className="py-6 text-center">
                <p className="text-[15px] font-semibold text-teal">Feedback sent — thank you!</p>
                <button
                  onClick={close}
                  className="mt-4 text-[13px] font-semibold text-graphite hover:text-ink"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what worked, what was confusing, or any bugs you found…"
                  rows={5}
                  disabled={state === "sending"}
                  className="w-full border border-hairline rounded-[3px] px-3 py-2 text-[13px] text-ink placeholder:text-muted bg-paper resize-none focus:outline-none focus:ring-1 focus:ring-teal disabled:opacity-50"
                />

                {state === "error" && (
                  <p className="text-[12px] text-brick">Something went wrong — please try again.</p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={close}
                    disabled={state === "sending"}
                    className="text-[13px] font-semibold text-graphite hover:text-ink disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={state === "sending" || !message.trim()}
                    className="px-4 py-2 bg-teal text-surface text-[13px] font-semibold rounded-[3px] hover:bg-teal/90 disabled:opacity-40 transition-colors"
                  >
                    {state === "sending" ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
