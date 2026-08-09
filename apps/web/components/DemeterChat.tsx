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
import {
  RECOMPOSE_MARKER,
  ANSWER_LANGS,
  LANG_NATIVE_NAME,
  type PackMeta,
  type AnswerLang,
} from "@civica/demeter-engine/packs";
// TYPE-ONLY from the root barrel: erased at compile time, so this costs the
// browser bundle nothing. A VALUE import here would drag the 1MB eCFR corpus
// onto every phone — the reason the client-safe /packs entry exists at all.
import type { ScreeningClassification, PartialFacts } from "@civica/demeter-engine";
import { DemeterMark } from "./DemeterMark";
import { DemeterStatePicker } from "./DemeterStatePicker";
import { DemeterWorksheet } from "./DemeterWorksheet";

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
    picker: {
      label: "Your state",
      federal: "All states (federal rules)",
      federalHint: "Federal floor — state figures deferred to your agency",
      search: "Search by state, program, or agency…",
      verified: "Verified",
      noMatch: "No verified pack for that state yet — federal rules still apply.",
    },
    howWeVerify: "How we verify",
    languageLabel: "Language",
    worksheet: {
      title: "Your estimate",
      subtitle: "Builds as you talk",
      result: "Where this lands",
      estimate: "Estimated monthly benefit:",
      calc: "How that was worked out",
      stillNeeded: "Still needed",
      empty:
        "Tell Demeter about your household — who lives with you, what you earn, what you pay in rent — and your estimate builds here.",
      privacy: "Nothing here is saved. Close this tab and it is gone.",
      disclaimer: "An estimate, not a decision. Your county agency decides.",
      pickState: "Pick your state above and your estimate can build here as you talk.",
    },
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
    picker: {
      label: "Tu estado",
      federal: "Todos los estados (reglas federales)",
      federalHint: "Base federal — las cifras estatales se remiten a tu agencia",
      search: "Busca por estado, programa o agencia…",
      verified: "Verificado",
      noMatch: "Aún no hay paquete verificado para ese estado — las reglas federales aplican.",
    },
    howWeVerify: "Cómo verificamos",
    languageLabel: "Idioma",
    worksheet: {
      title: "Tu estimado",
      subtitle: "Se arma mientras conversas",
      result: "Dónde queda esto",
      estimate: "Beneficio mensual estimado:",
      calc: "Cómo se calculó",
      stillNeeded: "Todavía falta",
      empty:
        "Cuéntale a Demeter sobre tu hogar — quién vive contigo, cuánto ganas, cuánto pagas de renta — y tu estimado se arma aquí.",
      privacy: "Nada de esto se guarda. Cierra esta pestaña y desaparece.",
      disclaimer: "Un estimado, no una decisión. Tu agencia del condado decide.",
      pickState: "Elige tu estado arriba y tu estimado se irá armando aquí.",
    },
  },
  vi: {
    title: "Demeter",
    tagline: "Câu trả lời đã được xác minh về SNAP — cho mọi tiểu bang.",
    inputPlaceholder: "Hỏi bất cứ điều gì về SNAP…",
    send: "Gửi",
    stop: "Dừng",
    stateLabel: "Tiểu bang của bạn",
    federal: "Tất cả tiểu bang (quy định liên bang)",
    verified: "Đã xác minh",
    federalBadge: "Hướng dẫn liên bang",
    dividerTo: (name: string) =>
      `Bây giờ đang trả lời cho ${name} — các câu trả lời trước có thể không còn áp dụng.`,
    dividerFederal:
      "Bây giờ chỉ trả lời theo quy định liên bang — các câu trả lời trước có thể không còn áp dụng.",
    disclaimer:
      "Demeter cung cấp thông tin, không phải tư vấn pháp lý. Hãy xác nhận quyết định với cơ quan SNAP của bạn.",
    err429: "Quá nhiều câu hỏi cùng lúc — vui lòng đợi một phút rồi thử lại.",
    errCapacity:
      "Demeter đã đạt giới hạn của tháng. Để được trợ giúp về SNAP ngay bây giờ, hãy gọi 211 hoặc cơ quan SNAP của tiểu bang bạn.",
    errConfig: "Demeter chưa sẵn sàng — vui lòng quay lại sau.",
    errNetwork: "Đã xảy ra lỗi. Vui lòng thử lại.",
    thinking: "Đang đọc các quy định…",
    empty1: "Giới hạn thu nhập cho hộ gia đình tôi là bao nhiêu?",
    empty2: "Tôi có thể nhận trợ cấp nhanh thế nào trong trường hợp khẩn cấp?",
    empty3: "Tôi có bắt buộc phải phỏng vấn qua điện thoại không?",
    picker: {
      label: "Tiểu bang của bạn",
      federal: "Tất cả tiểu bang (quy định liên bang)",
      federalHint: "Mức cơ bản liên bang — các con số của tiểu bang do cơ quan bạn quyết định",
      search: "Tìm theo tiểu bang, chương trình hoặc cơ quan…",
      verified: "Đã xác minh",
      noMatch: "Chưa có gói đã xác minh cho tiểu bang đó — quy định liên bang vẫn áp dụng.",
    },
    howWeVerify: "Cách chúng tôi xác minh",
    languageLabel: "Ngôn ngữ",
    worksheet: {
      title: "Ước tính của bạn",
      subtitle: "Được xây dựng khi bạn trò chuyện",
      result: "Kết quả tạm tính",
      estimate: "Trợ cấp hàng tháng ước tính:",
      calc: "Cách tính ra con số đó",
      stillNeeded: "Còn thiếu",
      empty:
        "Hãy cho Demeter biết về hộ gia đình của bạn — ai sống cùng bạn, bạn kiếm được bao nhiêu, bạn trả bao nhiêu tiền thuê nhà — và ước tính sẽ hiện ở đây.",
      privacy: "Không có gì ở đây được lưu lại. Đóng tab này là mọi thứ biến mất.",
      disclaimer: "Chỉ là ước tính, không phải quyết định. Cơ quan quận của bạn mới là nơi quyết định.",
      pickState: "Chọn tiểu bang của bạn ở trên để ước tính có thể hiện ở đây.",
    },
  },
  zh: {
    title: "Demeter",
    tagline: "经过核实的 SNAP 答案——适用于任何州。",
    inputPlaceholder: "关于 SNAP，想问什么都可以…",
    send: "发送",
    stop: "停止",
    stateLabel: "您所在的州",
    federal: "所有州（联邦规定）",
    verified: "已核实",
    federalBadge: "联邦指引",
    dividerTo: (name: string) => `现在按 ${name} 的规定回答——之前的回答可能不再适用。`,
    dividerFederal: "现在仅按联邦规定回答——之前的回答可能不再适用。",
    disclaimer: "Demeter 提供信息，而非法律建议。请与您所在州的 SNAP 机构确认。",
    err429: "同时提问太多了——请稍等一分钟再试。",
    errCapacity:
      "Demeter 本月已达使用上限。如需即时的 SNAP 帮助，请拨打 211 或联系您所在州的 SNAP 机构。",
    errConfig: "Demeter 尚未开放——请稍后再来。",
    errNetwork: "出了点问题。请再试一次。",
    thinking: "正在查阅法规…",
    empty1: "我家的收入上限是多少？",
    empty2: "紧急情况下我最快多久能拿到补助？",
    empty3: "我必须接受电话面谈吗？",
    picker: {
      label: "您所在的州",
      federal: "所有州（联邦规定）",
      federalHint: "联邦最低标准——各州的具体金额请以您所在机构为准",
      search: "按州、项目或机构搜索…",
      verified: "已核实",
      noMatch: "该州暂无已核实的政策包——联邦规定仍然适用。",
    },
    howWeVerify: "我们如何核实",
    languageLabel: "语言",
    worksheet: {
      title: "您的估算",
      subtitle: "随着对话逐步生成",
      result: "初步结果",
      estimate: "每月估计补助：",
      calc: "计算方式",
      stillNeeded: "仍需提供",
      empty:
        "告诉 Demeter 您的家庭情况——谁和您同住、收入多少、房租多少——估算就会在这里逐步生成。",
      privacy: "这里的内容不会被保存。关闭此页面即消失。",
      disclaimer: "这只是估算，不是决定。最终由您所在县的机构裁定。",
      pickState: "请在上方选择您所在的州，估算就能在这里生成。",
    },
  },
} as const;

export function DemeterChat({
  states,
  initialState = null,
  initialQuestion = null,
}: {
  states: PackMeta[];
  initialState?: string | null;
  initialQuestion?: string | null;
}) {
  const [lang, setLang] = useState<AnswerLang>("en");
  const [state, setState] = useState<string | null>(initialState);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialQuestion ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The right rail's state. Held HERE and nowhere else — never persisted, so
  // it dies with the tab (see the worksheet route's header). Facts live in a
  // ref rather than state: nothing renders them directly (the rail renders the
  // CLASSIFICATION), and a ref is always current inside the async callback,
  // where a state value would be a stale closure a turn behind.
  const factsRef = useRef<PartialFacts>({});
  const [classification, setClassification] = useState<ScreeningClassification | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const t = T[lang];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const changeState = (next: string | null) => {
    if (next === state) return;
    setState(next);
    // The verdict is state-specific — snap-rules computed it against the old
    // state's parameters, so keeping it on screen under a new state's heading
    // would be showing someone a number that no longer applies. The FACTS
    // survive (household size and income don't change with the scope); only
    // the computed outcome is dropped, and the next turn recomputes it.
    setClassification(null);
    if (messages.some((m) => m.role !== "divider")) {
      const name = next ? states.find((s) => s.code === next)?.program ?? next : null;
      setMessages((m) => [
        ...m,
        { role: "divider", content: name ? t.dividerTo(name) : t.dividerFederal },
      ]);
    }
  };

  /** Update the right rail. Never throws into the caller and never surfaces an
   *  error in the chat: a quiet rail is an acceptable degradation, a chat that
   *  reports "something went wrong" because a side panel failed is not. */
  const refreshWorksheet = useCallback(
    async (apiMessages: Array<{ role: "user" | "assistant"; content: string }>) => {
      if (!state) return;
      try {
        const res = await fetch("/api/demeter/worksheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, facts: factsRef.current, state }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          facts?: PartialFacts;
          classification?: ScreeningClassification | null;
        };
        if (data.facts) factsRef.current = data.facts;
        // Null classification = the route soft-failed or found nothing yet.
        // Keep whatever is already on screen rather than blanking the panel.
        if (data.classification) setClassification(data.classification);
      } catch {
        /* soft by design */
      }
    },
    [state],
  );

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

    // The rail updates ALONGSIDE the answer, not after it: a second round trip
    // in series would make every reply feel slower for a panel that is
    // supplementary. It is intentionally not awaited and intentionally cannot
    // throw into this scope — the answer must not depend on it.
    if (state) void refreshWorksheet(apiMessages);

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
        {/* A real picker, not a two-way toggle: the engine now answers in four
            languages, and a toggle cannot express that. Each option is labelled
            in its OWN language — someone looking for Tiếng Việt is not helped by
            the word "Vietnamese". */}
        <label className="demeter__lang">
          <span className="sr-only">{t.languageLabel}</span>
          <select
            className="demeter__lang-select"
            value={lang}
            aria-label={t.languageLabel}
            onChange={(e) => setLang(e.target.value as AnswerLang)}
          >
            {ANSWER_LANGS.map((code) => (
              <option key={code} value={code}>
                {LANG_NATIVE_NAME[code]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* One control, one selected state — replaces the chip row that ate a
          full row and still clipped this link off the right edge at 1280px. */}
      <div className="demeter__scope">
        <DemeterStatePicker
          states={states}
          value={state}
          onChange={changeState}
          copy={t.picker}
        />
        <a className="demeter__how" href="/verify">
          {t.howWeVerify}
        </a>
      </div>

      <div className="demeter__body">
        <div className="demeter__main">
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
        <DemeterWorksheet
          classification={classification}
          stateSelected={state !== null}
          copy={t.worksheet}
        />
      </div>
    </div>
  );
}
