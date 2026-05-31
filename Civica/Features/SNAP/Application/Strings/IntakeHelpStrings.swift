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
        es: "Pregúntale a Mae sobre esta pregunta"
    )

    // MARK: - Sheet chrome

    /// Navigation title on the contextual-help sheet.
    static let sheetTitle = CivicaText(
        "Ask Mae",
        es: "Pregúntale a Mae"
    )

    /// Dismiss control on the sheet.
    static let sheetDoneButton = CivicaText(
        "Done",
        es: "Listo"
    )

    // MARK: - Loading states
    //
    // Two-stage loading copy per D6: the first message shows
    // immediately; if the AI hasn't responded within ~1.5s the sheet
    // swaps to the "still thinking" message so the user knows we're
    // not stuck.

    /// Immediate loading text on sheet appear.
    static let loadingText = CivicaText(
        "Looking that up…",
        es: "Buscando esa información…"
    )

    /// Swap-in after ~1.5s elapsed without a response.
    static let stillThinkingText = CivicaText(
        "Still thinking…",
        es: "Todavía buscando…"
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
        es: "{title}. No pudimos conectar con nuestro asistente en este momento. Tu orientador del condado puede aclarar lo que pregunta esta pregunta."
    )

    /// Standalone navigator nudge — used when the title is too long to
    /// echo gracefully, or when the success path wants to append a
    /// closing reassurance.
    static let navigatorNudge = CivicaText(
        "Your county navigator can clarify what this question is asking.",
        es: "Tu orientador del condado puede aclarar lo que pregunta esta pregunta."
    )

    // MARK: - Chat input

    /// Placeholder text in the chat TextField at the bottom of the
    /// sheet. Visible when the field is empty so the affordance is
    /// obvious without needing a label above it.
    static let chatInputPlaceholder = CivicaText(
        "Ask a follow-up…",
        es: "Haz una pregunta…"
    )

    /// Accessibility label on the send button next to the TextField.
    static let chatSendButtonLabel = CivicaText(
        "Send",
        es: "Enviar"
    )

    /// Tiny header label above the chat scroll area introducing Mae as
    /// the assistant the applicant is talking with. Reuses the same
    /// "Ask Mae" framing as the nav-bar title so the voice is
    /// consistent.
    static let chatIntroLabel = CivicaText(
        "Mae · SNAP assistant",
        es: "Mae · asistente de SNAP"
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
    ]
}
