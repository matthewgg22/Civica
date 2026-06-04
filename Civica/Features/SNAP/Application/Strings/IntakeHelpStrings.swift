import Foundation

// Strings for the SNAP intake contextual-help sheet (per office-hours
// design doc 2026-05-29, GSTACK REVIEW REPORT D6 / T6 / T7).
//
// Mirrors the EBT*Strings split-per-feature pattern (per CLAUDE.md
// "EBT module conventions"): every CivicaText MUST have BOTH .en
// and .es. Drift here ships as an empty Spanish label, never a
// crash — the IntakeHelpStringParityTests guard catches it at CI.
//
// Scope: the small help marker on every SNAP application question
// (CivicaQuestionScreen, all 17+ pages) → sheet presentation
// (loading / success / error states) → safe fallback when the
// LLM endpoint is unreachable or times out.
//
// Hard rule per D6: the error fallback always echoes the question
// title and nudges the user toward their county navigator. The AI
// EXPLAINS questions; it never COMMITS to eligibility outcomes.

enum IntakeHelpStrings {

    // MARK: - Marker (accessibility)

    /// Accessibility label on the questionmark.circle button rendered
    /// next to every question title. Visual is icon-only — VoiceOver
    /// users get the full label.
    static let helpButtonAccessibilityLabel = CivicaText(
        "Ask Mae about this question",
        es: "Pregúntale a Mae sobre esta pregunta",
        zh: "向 Mae 询问这个问题",
        vi: "Hỏi Mae về câu hỏi này",
        tl: "Itanong kay Mae ang tungkol sa tanong na ito"
    )

    // MARK: - Sheet chrome

    /// Navigation title on the contextual-help sheet.
    static let sheetTitle = CivicaText(
        "Ask Mae",
        es: "Pregúntale a Mae",
        zh: "询问 Mae",
        vi: "Hỏi Mae",
        tl: "Itanong kay Mae"
    )

    /// Dismiss control on the sheet.
    static let sheetDoneButton = CivicaText(
        "Done",
        es: "Listo",
        zh: "完成",
        vi: "Xong",
        tl: "Tapos na"
    )

    // MARK: - Loading states
    //
    // Two-stage loading copy per D6: the first message shows
    // immediately; if the AI hasn't responded within ~1.5s the sheet
    // swaps to the "still thinking" message so the user knows we're
    // not stuck.

    /// Immediate loading text on sheet appear. Names what Mae is
    /// actually doing (reading the question + helper) in a calm,
    /// human voice — no "thinking"/"searching" robot-speak.
    static let loadingText = CivicaText(
        "Reading your question…",
        es: "Leyendo tu pregunta…",
        zh: "正在阅读你的问题……",
        vi: "Đang đọc câu hỏi của bạn…",
        tl: "Binabasa ang iyong tanong…"
    )

    /// Swap-in after ~1.5s elapsed without a response. Universal
    /// calm-wait phrase, no anthropomorphizing.
    static let stillThinkingText = CivicaText(
        "One moment…",
        es: "Un momento…",
        zh: "请稍等……",
        vi: "Chờ một chút…",
        tl: "Sandali lang…"
    )

    // MARK: - Error fallback (per D6 — load-bearing)
    //
    // When the endpoint fails (network / 429 / 500 / timeout / decode),
    // the sheet must NOT show a generic "something went wrong" page.
    // Instead it echoes the question title back to the user and nudges
    // them toward their county navigator. This preserves the demo's
    // credibility — the AI never silently fails into a refusal that
    // makes the universal-coverage thesis look broken.

    /// Template for the offline / error / timeout fallback. View
    /// substitutes the {title} placeholder with the actual question.
    static let errorFallbackTemplate = CivicaText(
        "{title}. We could not reach our assistant just now. Your county navigator can clarify what this question is asking.",
        es: "{title}. No pudimos conectar con nuestro asistente en este momento. Tu orientador del condado puede aclarar lo que pregunta esta pregunta.",
        zh: "{title}。我们暂时无法连接到助手。你所在县的导航员可以为你解释这个问题在问什么。",
        vi: "{title}. Chúng tôi không thể kết nối với trợ lý ngay lúc này. Nhân viên hướng dẫn của county có thể giải thích câu hỏi này đang hỏi gì.",
        tl: "{title}. Hindi namin maabot ang aming assistant ngayon. Maipapaliwanag ng iyong county navigator kung ano ang itinatanong dito."
    )

    /// Standalone navigator nudge — used when the title is too long to
    /// echo gracefully, or when the success path wants to append a
    /// closing reassurance.
    static let navigatorNudge = CivicaText(
        "Your county navigator can clarify what this question is asking.",
        es: "Tu orientador del condado puede aclarar lo que pregunta esta pregunta.",
        zh: "你所在县的导航员可以为你解释这个问题在问什么。",
        vi: "Nhân viên hướng dẫn của county có thể giải thích câu hỏi này đang hỏi gì.",
        tl: "Maipapaliwanag ng iyong county navigator kung ano ang itinatanong dito."
    )

    // MARK: - Chat input

    /// Placeholder text in the chat TextField at the bottom of the
    /// sheet. Visible when the field is empty so the affordance is
    /// obvious without needing a label above it.
    static let chatInputPlaceholder = CivicaText(
        "Ask a follow-up…",
        es: "Haz una pregunta…",
        zh: "继续提问……",
        vi: "Hỏi thêm câu nữa…",
        tl: "Magtanong pa…"
    )

    /// Accessibility label on the send button next to the TextField.
    static let chatSendButtonLabel = CivicaText(
        "Send",
        es: "Enviar",
        zh: "发送",
        vi: "Gửi",
        tl: "Ipadala"
    )

    /// Tiny header label above the chat scroll area introducing Mae as
    /// the assistant the applicant is talking with. Reuses the same
    /// "Ask Mae" framing as the nav-bar title so the voice is
    /// consistent.
    static let chatIntroLabel = CivicaText(
        "Mae · SNAP assistant",
        es: "Mae · asistente de SNAP",
        zh: "Mae · SNAP 助手",
        vi: "Mae · trợ lý SNAP",
        tl: "Mae · katulong sa SNAP"
    )

    /// AI-transparency line shown just above the chat input. Keeps the
    /// disclosure where the applicant is about to type, not buried in
    /// settings.
    static let aiDisclaimer = CivicaText(
        "Mae is an AI assistant. Double-check anything important with your county navigator.",
        es: "Mae es un asistente de IA. Confirma cualquier cosa importante con tu orientador del condado.",
        zh: "Mae 是一个 AI 助手。重要的事情请向你所在县的导航员再确认一遍。",
        vi: "Mae là trợ lý AI. Hãy kiểm tra lại bất cứ điều gì quan trọng với nhân viên hướng dẫn của county.",
        tl: "Si Mae ay AI assistant. I-double check ang anumang mahalaga sa iyong county navigator."
    )

    // MARK: - View helpers
    //
    // Convenience for the sheet view: substitute the question title
    // into the error template at render time. Keeps the placeholder
    // contract in one place so a template tweak doesn't leak the
    // "{title}" literal into the UI on a typo.

    /// Resolves the error fallback template with the user's actual
    /// question title substituted for `{title}`.
    static func errorFallback(title: String, language: CivicaLanguage) -> String {
        let template = errorFallbackTemplate.value(in: language)
        return template.replacingOccurrences(of: "{title}", with: title)
    }

    // MARK: - Parity introspection
    //
    // Mirrors the EBT*Strings `.all` pattern: each namespace exposes a
    // curated list of every CivicaText constant so a parity test can
    // assert non-empty EN + ES on every entry. Adding a new string
    // requires appending it here; the parity test failing is the
    // safety net if you forget.

    static let all: [CivicaText] = [
        helpButtonAccessibilityLabel,
        sheetTitle,
        sheetDoneButton,
        loadingText,
        stillThinkingText,
        errorFallbackTemplate,
        navigatorNudge,
        chatInputPlaceholder,
        chatSendButtonLabel,
        chatIntroLabel,
        aiDisclaimer,
    ]
}
