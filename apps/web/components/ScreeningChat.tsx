"use client";

// The active screening interface (mockup frames 03/04): chat on the left,
// the live worksheet on the right. One POST /api/screen per turn — no
// streaming (screenHousehold's tool-call extraction has nothing to stream),
// so this is simpler than DemeterChat: send, wait, render the result.

import { useCallback, useRef, useState } from "react";
import type { ScreeningClassification } from "@civica/demeter-engine";
import { DemeterMark } from "./DemeterMark";
import { ScreeningWorksheet } from "./ScreeningWorksheet";

interface ChatMsg {
  role: "user" | "system";
  content: string;
  /** Present on the system reply that FOLLOWS a classification change —
   *  rendered with extra weight, matching the mockup's own bold outcome
   *  lines under each turn. */
  isOutcome?: boolean;
}

const STARTERS = [
  "Screen a household for eligibility",
  "Check a deduction or income rule",
  "Explain recertification timing",
];

const OUTCOME_LINE: Record<string, (c: ScreeningClassification) => string> = {
  not_enough_information: () => "Still building the picture. A few more details and I can screen this.",
  needs_county_review: (c) => c.summary,
  categorically_eligible: (c) => `Categorically eligible. ${c.summary}`,
  expedited: (c) => c.summary,
  likely_eligible: () => "Likely eligible based on what's been entered so far.",
  likely_ineligible: (c) => c.summary,
};

export function ScreeningChat({ initialState }: { initialState: string }) {
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [caseLabel, setCaseLabel] = useState<string | null>(null);
  const [state] = useState(initialState);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [classification, setClassification] = useState<ScreeningClassification | null>(null);
  const [guestLeft, setGuestLeft] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setError(null);
      setErrorReason(null);
      setBusy(true);
      setInput("");
      setMessages((m) => [...m, { role: "user", content: q }]);
      scrollDown();

      try {
        const res = await fetch("/api/screen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screeningId, message: q, state }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
          if (res.status === 403 && j.reason === "guest_cap_reached") {
            setGuestLeft(0);
            setErrorReason("guest_cap_reached");
            setError("Guest screening limit reached, sign in to keep going.");
          } else if (res.status === 429) {
            setError("Too many requests, try again in a minute.");
          } else {
            setError(j.error ?? "Something went wrong. Please try again.");
          }
          return;
        }
        const json = (await res.json()) as {
          screeningId: string;
          caseLabel: string | null;
          classification: ScreeningClassification;
          guestScreeningsLeft: number | null;
        };
        setScreeningId(json.screeningId);
        setCaseLabel(json.caseLabel);
        setClassification(json.classification);
        setGuestLeft(json.guestScreeningsLeft);

        const line = OUTCOME_LINE[json.classification.outcome]?.(json.classification) ?? json.classification.summary;
        setMessages((m) => [...m, { role: "system", content: line, isOutcome: true }]);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setBusy(false);
        scrollDown();
      }
    },
    [busy, screeningId, state, scrollDown],
  );

  const hasChat = messages.length > 0;

  return (
    <div className="screening">
      <header className="screening__head">
        <div className="screening__brand">
          <DemeterMark size={32} />
          <div>
            <div className="screening__title">Demeter</div>
            <div className="screening__sub">SNAP screening · {state}</div>
          </div>
        </div>
        {caseLabel ? (
          <span className="screening__case-chip">Case {caseLabel}</span>
        ) : (
          <span className="screening__case-chip">New case</span>
        )}
      </header>

      <div className="screening__body">
        <div className="screening__chat">
          <div className="screening__scroll" ref={scrollRef}>
            {!hasChat && (
              <div className="screening__empty">
                <p className="screening__empty-lede">
                  Describe the household and I&apos;ll screen it against current policy.
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--demeter-mono)" }}>Common starting points</p>
                {STARTERS.map((s) => (
                  <button key={s} type="button" className="screening__starter" onClick={() => setInput(s)}>
                    {s} →
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`screening__msg screening__msg--${m.role}${m.isOutcome ? " screening__msg--outcome" : ""}`}
              >
                {m.content}
              </div>
            ))}
            {error && (
              <div className="screening__error">
                {error}
                {errorReason === "guest_cap_reached" && (
                  <a className="screening__error-cta" href="/screen/sign-in">
                    Sign in →
                  </a>
                )}
              </div>
            )}
          </div>
          <form
            className="screening__inputrow"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              className="screening__input"
              placeholder="Describe the household, or ask a policy question…"
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <button type="submit" className="screening__send" disabled={busy || !input.trim()}>
              {busy ? "…" : "Send"}
            </button>
          </form>
          <p className="screening__disclaimer">
            Screening estimate only. The county agency makes the final determination.
          </p>
        </div>

        <ScreeningWorksheet
          screeningId={screeningId}
          caseLabel={caseLabel}
          stateCode={state}
          classification={classification}
          guestScreeningsLeft={guestLeft}
        />
      </div>
    </div>
  );
}
