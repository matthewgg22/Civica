"use client";

// Demeter — the public SNAP answers chat (mobile-first: F8 acceptance criteria).
//
// Behaviors wired to the engine protocol:
//  - streaming plain text; the RECOMPOSE marker REPLACES the unverified draft;
//  - state selector: verified states carry a ✓ badge; "All states" = the
//    federal floor (the engine never defaults a public user to any state);
//  - switching state mid-chat inserts a visible divider (answers re-scope);
//  - EN/ES toggle (answers only — citations stay verbatim);
//  - 429 / at-capacity / unconfigured states render honest, warm errors.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RECOMPOSE_MARKER } from "@civica/demeter-engine/packs";
import { DemeterMark } from "./DemeterMark";

interface PackMetaLite {
  code: string;
  program: string;
  verified: boolean;
}

type Msg =
  | { role: "user" | "assistant"; content: string }
  | { role: "divider"; content: string };



// Answers arrive as light markdown (the engine's prompt asks for bold, bullets,
// and a `---` rule before the citation trailer). Render exactly that subset as
// React nodes — never raw HTML, so streamed content has no injection surface.
// Bullets and line breaks come free from the bubble's `white-space: pre-wrap`.
function renderInline(line: string, keyBase: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((p, j) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={`${keyBase}b${j}`}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={`${keyBase}i${j}`}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
}

export function renderAnswer(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.trim() === "---") {
      out.push(<hr key={`hr${i}`} className="demeter__rule" />);
      return;
    }
    if (i > 0 && lines[i - 1]?.trim() !== "---") out.push("\n");
    out.push(...renderInline(line, `l${i}`));
  });
  return out;
}

const T = {
  en: {
    title: "Demeter",
    tagline: "Verified answers about SNAP — for any state.",
    inputPlaceholder: "Ask anything about SNAP…",
    send: "Send",
    stop: "Stop",
    stateLabel: "Your state",
    federal: "All states (federal rules)",
    verified: "Verified",
    federalBadge: "Federal guidance",
    dividerTo: (name: string) => `Now answering for ${name} — earlier answers may not apply.`,
    dividerFederal: "Now answering with federal rules only — earlier answers may not apply.",
    disclaimer:
      "Demeter gives information, not legal advice. Confirm decisions with your SNAP agency.",
    err429: "Too many questions at once — give it a minute and try again.",
    errCapacity:
      "Demeter is at capacity for the month. For SNAP help right now, call 211 or your state SNAP agency.",
    errConfig: "Demeter isn't available yet — please check back soon.",
    errNetwork: "Something went wrong. Please try again.",
    thinking: "Reading the rules…",
    empty1: "What's the income limit for my household?",
    empty2: "How fast can I get benefits in an emergency?",
    empty3: "Do I have to do a phone interview?",
  },
  es: {
    title: "Demeter",
    tagline: "Respuestas verificadas sobre SNAP — para cualquier estado.",
    inputPlaceholder: "Pregunta lo que sea sobre SNAP…",
    send: "Enviar",
    stop: "Parar",
    stateLabel: "Tu estado",
    federal: "Todos los estados (reglas federales)",
    verified: "Verificado",
    federalBadge: "Guía federal",
    dividerTo: (name: string) =>
      `Ahora respondiendo para ${name} — las respuestas anteriores pueden no aplicar.`,
    dividerFederal:
      "Ahora respondiendo solo con reglas federales — las respuestas anteriores pueden no aplicar.",
    disclaimer:
      "Demeter da información, no asesoría legal. Confirma las decisiones con tu agencia de SNAP.",
    err429: "Demasiadas preguntas a la vez — espera un minuto e intenta de nuevo.",
    errCapacity:
      "Demeter llegó a su capacidad del mes. Para ayuda con SNAP ahora, llama al 211 o a tu agencia estatal.",
    errConfig: "Demeter aún no está disponible — vuelve pronto.",
    errNetwork: "Algo salió mal. Intenta de nuevo.",
    thinking: "Leyendo las reglas…",
    empty1: "¿Cuál es el límite de ingresos para mi hogar?",
    empty2: "¿Qué tan rápido puedo recibir beneficios en una emergencia?",
    empty3: "¿Tengo que hacer una entrevista por teléfono?",
  },
} as const;

export function DemeterChat({
  states,
  initialState = null,
  initialQuestion = null,
}: {
  states: PackMetaLite[];
  initialState?: string | null;
  initialQuestion?: string | null;
}) {
  const [lang, setLang] = useState<"en" | "es">("en");
  const [state, setState] = useState<string | null>(initialState);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const t = T[lang];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const changeState = (next: string | null) => {
    if (next === state) return;
    setState(next);
    if (messages.some((m) => m.role !== "divider")) {
      const name = next ? states.find((s) => s.code === next)?.program ?? next : null;
      setMessages((m) => [
        ...m,
        { role: "divider", content: name ? t.dividerTo(name) : t.dividerFederal },
      ]);
    }
  };

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setBusy(true);
    setInput("");

    const chatTurns = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } => m.role !== "divider",
    );
    const apiMessages = [...chatTurns, { role: "user" as const, content: question }].slice(-20);
    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    const dropPlaceholder = () =>
      setMessages((m) =>
        m[m.length - 1]?.role === "assistant" && m[m.length - 1]?.content === ""
          ? m.slice(0, -1)
          : m,
      );

    try {
      const res = await fetch("/api/demeter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, state, lang }),
        signal: controller.signal,
      });

      if (!res.ok) {
        dropPlaceholder();
        let reason = "";
        try {
          reason = ((await res.json()) as { reason?: string }).reason ?? "";
        } catch { /* non-JSON error body */ }
        setError(
          res.status === 429
            ? t.err429
            : reason === "at_capacity"
              ? t.errCapacity
              : res.status === 503
                ? t.errConfig
                : t.errNetwork,
        );
        return;
      }

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
              const combined = last.content + chunk;
              const markerAt = combined.lastIndexOf(RECOMPOSE_MARKER);
              copy[copy.length - 1] = {
                role: "assistant",
                content:
                  markerAt >= 0
                    ? combined.slice(markerAt + RECOMPOSE_MARKER.length).replace(/^\s+/, "")
                    : combined,
              };
            }
            return copy;
          });
        }
      }
    } catch (err) {
      dropPlaceholder();
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(t.errNetwork);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [input, busy, messages, state, lang, t]);

  const hasChat = messages.length > 0;

  return (
    <div className="demeter">
      <header className="demeter__head">
        <div className="demeter__brand">
          <span className="demeter__avatar" aria-hidden>
            <DemeterMark size={40} />
          </span>
          <div>
            <h1 className="demeter__title">{t.title}</h1>
            <p className="demeter__tagline">{t.tagline}</p>
          </div>
        </div>
        <button
          type="button"
          className="demeter__lang"
          onClick={() => setLang(lang === "en" ? "es" : "en")}
          aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}
        >
          {lang === "en" ? "Español" : "English"}
        </button>
      </header>

      <div className="demeter__states" role="radiogroup" aria-label={t.stateLabel}>
        <button
          type="button"
          role="radio"
          aria-checked={state === null}
          className={`demeter__state ${state === null ? "is-active" : ""}`}
          onClick={() => changeState(null)}
        >
          {t.federal}
        </button>
        {states.map((s) => (
          <button
            key={s.code}
            type="button"
            role="radio"
            aria-checked={state === s.code}
            className={`demeter__state ${state === s.code ? "is-active" : ""}`}
            onClick={() => changeState(s.code)}
          >
            {s.code}
            <span className="demeter__badge" title={`${t.verified} — ${s.program}`}>
              ✓
            </span>
          </button>
        ))}
        <a className="demeter__how" href="/verify">
          {lang === "en" ? "How we verify" : "Cómo verificamos"}
        </a>
      </div>

      <div className="demeter__scroll" ref={scrollRef}>
        {!hasChat && (
          <div className="demeter__empty">
            {[t.empty1, t.empty2, t.empty3].map((q) => (
              <button key={q} type="button" className="demeter__suggest" onClick={() => setInput(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "divider" ? (
            <div key={i} className="demeter__divider" role="status">
              {m.content}
            </div>
          ) : (
            <div key={i} className={`demeter__msg demeter__msg--${m.role}`}>
              {m.content ? (
                m.role === "assistant" ? (
                  renderAnswer(m.content)
                ) : (
                  m.content
                )
              ) : m.role === "assistant" && busy && i === messages.length - 1 ? (
                <span className="demeter__thinking">{t.thinking}</span>
              ) : (
                m.content
              )}
            </div>
          ),
        )}
        {error && (
          <div className="demeter__error" role="alert">
            {error}
          </div>
        )}
      </div>

      <form
        className="demeter__inputrow"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="demeter__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t.inputPlaceholder}
          rows={1}
          aria-label={t.inputPlaceholder}
        />
        {busy ? (
          <button
            type="button"
            className="demeter__send demeter__send--stop"
            onClick={() => abortRef.current?.abort()}
          >
            {t.stop}
          </button>
        ) : (
          <button type="submit" className="demeter__send" disabled={!input.trim()}>
            {t.send}
          </button>
        )}
      </form>
      <p className="demeter__disclaimer">{t.disclaimer}</p>
    </div>
  );
}
