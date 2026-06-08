"use client";

// Mae — caseworker SNAP policy assistant, surfaced as a floating panel across
// the authenticated dashboard (navigators on /outreach + /packets, and a
// logged-in CBO user on /cbo-preview). The applicant-facing Mae lives in iOS +
// apps/web; this is the staff counterpart, backed by /api/mae.
//
// Self-gating: the FAB only renders for an authenticated staff session, so the
// public (anonymous) /cbo-preview marketing page stays clean. The /api/mae
// route enforces the same gate server-side regardless of what the client does.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "../lib/supabase";
import { isStaff } from "../lib/roleRouting";

// Persistent UI disclaimer — shown in the panel regardless of any single
// answer's content. Mirrors lib/mae/system-prompt.ts MAE_DISCLAIMER (kept inline
// here so the server-only system prompt never ships to the browser bundle).
const MAE_DISCLAIMER =
  "Mae can be wrong. General SNAP policy guidance, not an eligibility determination — verify against current CalFresh/CDSS rules and the county system of record.";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Public-preview mode: when on, Mae's chat opens for anonymous visitors on the
// /cbo-preview demo (the /api/mae route honors the same flag server-side). Off
// by default — the portal stays staff-gated.
const PREVIEW_OPEN = process.env.NEXT_PUBLIC_MAE_PREVIEW === "true";

// Per-answer feedback — the human-in-the-loop signal. 👍/👎; a 👎 expands a
// reason (esp. "citation wrong") + optional note. Posts to /api/mae/feedback,
// which PII-scrubs and stores it for the answer-eval triage queue. Best-effort.
function MaeFeedback({ question, answer }: { question: string; answer: string }) {
  const [stage, setStage] = useState<"idle" | "reason" | "sent">("idle");
  const [note, setNote] = useState("");

  const submit = (rating: "up" | "down", reason?: string) => {
    setStage("sent");
    void fetch("/api/mae/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, reason, note: note.trim() || undefined, question, answer }),
    }).catch(() => {
      /* best-effort — don't disrupt the caseworker */
    });
  };

  if (stage === "sent") {
    return <p className="mt-1 text-[11px] text-muted">Thanks — feedback recorded.</p>;
  }
  if (stage === "reason") {
    return (
      <div className="mt-1 space-y-1">
        <div className="flex flex-wrap gap-1">
          {[
            ["citation_wrong", "Citation wrong"],
            ["incorrect", "Incorrect"],
            ["unclear", "Unclear"],
          ].map(([r, label]) => (
            <button
              key={r}
              type="button"
              onClick={() => submit("down", r)}
              className="rounded-[2px] border border-hairline px-1.5 py-0.5 text-[11px] text-ink hover:bg-surface-secondary"
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was wrong? (optional)"
          className="w-full rounded-[2px] border border-hairline bg-input px-1.5 py-1 text-[11px] text-ink outline-none placeholder:text-muted focus:border-pine"
        />
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
      <span>Was this helpful?</span>
      <button type="button" aria-label="Helpful" onClick={() => submit("up")} className="hover:text-ink">
        👍
      </button>
      <button type="button" aria-label="Not helpful" onClick={() => setStage("reason")} className="hover:text-ink">
        👎
      </button>
    </div>
  );
}

export default function MaeChat() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Gate to authenticated staff. Anonymous visitors and non-staff see nothing.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await createClient().auth.getUser();
        const role = (data.user?.app_metadata as { role?: unknown } | null)?.role;
        if (active && isStaff(role)) setAllowed(true);
      } catch {
        /* not signed in — leave hidden */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Open prefilled when another surface fires "mae:prefill" (e.g. the CBO
  // pipeline's "Ask Mae about this case" button). Decoupled via a window event
  // so callers don't import Mae.
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (typeof text === "string" && text) {
        setInput(text);
        setOpen(true);
      }
    };
    window.addEventListener("mae:prefill", onPrefill);
    return () => window.removeEventListener("mae:prefill", onPrefill);
  }, []);

  // Keep the transcript pinned to the latest message. Guard scrollTo — not all
  // environments (jsdom, some older browsers) implement it.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [messages, busy]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/mae", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg =
          res.status === 401 || res.status === 403
            ? "Your session expired. Refresh and sign in again."
            : res.status === 503
              ? "Mae isn't available yet — ask an admin to finish setup."
              : "Mae hit an error. Please try again.";
        setError(msg);
        setBusy(false);
        return;
      }

      // Stream the plain-text answer into a growing assistant message.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((m) => {
            const copy = m.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + chunk };
            }
            return copy;
          });
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Mae hit a network error. Please try again.");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const closePanel = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  // Render when staff, when public-preview mode is on, or when another surface
  // opened us via prefill (the CBO preview's "Ask Mae about this case").
  if (!allowed && !PREVIEW_OPEN && !open) return null;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Ask Mae — SNAP policy assistant"
          className="fixed bottom-20 right-4 z-50 flex h-[32rem] max-h-[calc(100vh-6rem)] w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[3px] border border-hairline bg-paper shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-hairline bg-surface px-3 py-2">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-pine text-xs font-semibold text-white"
            >
              M
            </span>
            <div className="flex-1 leading-tight">
              <p className="text-sm font-semibold text-ink">Ask Mae</p>
              <p className="text-[11px] text-muted">Calibrated to California · CalFresh rules</p>
            </div>
            <button
              type="button"
              aria-label="Close Mae"
              onClick={closePanel}
              className="rounded-[2px] px-2 py-1 text-muted hover:bg-surface-secondary hover:text-ink"
            >
              ✕
            </button>
          </div>

          {allowed || PREVIEW_OPEN ? (
            <>
          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="space-y-2 text-sm text-muted">
                <p className="text-ink">
                  Ask about SNAP/CalFresh eligibility, deductions, verification, work
                  requirements, or recertification.
                </p>
                <ul className="space-y-1 text-[13px]">
                  <li>• &ldquo;What counts as a shelter deduction?&rdquo;</li>
                  <li>• &ldquo;When does expedited service apply?&rdquo;</li>
                  <li>• &ldquo;How do ABAWD time limits work in California?&rdquo;</li>
                </ul>
                <p className="text-[11px] text-warning">
                  Don&rsquo;t paste an applicant&rsquo;s personal info — ask in general terms.
                </p>
              </div>
            )}

            {messages.map((m, i) => {
              const isAssistant = m.role === "assistant";
              const showFeedback = isAssistant && !!m.content && !(busy && i === messages.length - 1);
              return (
                <div
                  key={i}
                  className={isAssistant ? "flex flex-col items-start" : "flex justify-end"}
                >
                  <div
                    className={
                      isAssistant
                        ? "max-w-[92%] rounded-[3px] bg-surface px-3 py-2 text-sm text-ink"
                        : "max-w-[85%] rounded-[3px] bg-pine-surface px-3 py-2 text-sm text-ink"
                    }
                  >
                    {isAssistant ? (
                      m.content ? (
                        <div className="mae-prose space-y-2 [&_a]:text-pine [&_a]:underline [&_code]:rounded [&_code]:bg-surface-secondary [&_code]:px-1 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="text-muted">Mae is thinking…</span>
                      )
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                  {showFeedback && (
                    <MaeFeedback question={messages[i - 1]?.content ?? ""} answer={m.content} />
                  )}
                </div>
              );
            })}

            {error && <p className="text-sm text-brick">{error}</p>}
          </div>

          {/* Disclaimer */}
          <p className="border-t border-hairline bg-surface px-3 py-1.5 text-[10px] leading-tight text-muted">
            {MAE_DISCLAIMER}
          </p>

          {/* Composer */}
          <div className="flex items-end gap-2 border-t border-hairline bg-paper px-2 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Ask a SNAP policy question…"
              className="flex-1 resize-none rounded-[2px] border border-hairline bg-input px-2 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-pine"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || input.trim().length === 0}
              className="rounded-[2px] bg-pine px-3 py-2 text-sm font-medium text-white hover:bg-pine-pressed disabled:bg-pine-disabled"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
            </>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-6 text-sm">
              <p className="font-medium text-ink">You&rsquo;re previewing a navigator tool.</p>
              {input.trim() && (
                <div className="rounded-[3px] border border-hairline bg-surface px-3 py-2 text-ink">
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-muted">The question for this case</p>
                  <p className="text-sm">{input}</p>
                </div>
              )}
              <p className="text-muted">
                Inside the navigator portal, Mae answers this in place &mdash; citing the governing
                CalFresh rules, never applicant PII.
              </p>
              <Link
                href="/login"
                className="inline-block rounded-[2px] bg-pine px-3 py-2 text-sm font-medium text-white hover:bg-pine-pressed"
              >
                Open the navigator portal &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Floating launcher — staff, or anyone when public-preview mode is on. */}
      {(allowed || PREVIEW_OPEN) && (
        <button
          type="button"
          aria-expanded={open}
          aria-label="Ask Mae"
          onClick={() => (open ? closePanel() : setOpen(true))}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-pine px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-pine-pressed"
        >
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-semibold"
          >
            M
          </span>
          Ask Mae
        </button>
      )}
    </>
  );
}
