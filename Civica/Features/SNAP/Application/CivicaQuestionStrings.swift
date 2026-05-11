import Foundation

// Shared copy for CivicaQuestionScreen — the small labels (Continue,
// Skip, I'm not sure, "3 of 8") that show up on every one-question
// screen. Keyed bilingual per HANDOFF #4 Spanish parity gate.
//
// Concrete SNAP questions (household size, income, expenses, etc.)
// live in feature-scoped strings files. This file only owns the
// primitive's chrome.

enum CivicaQuestionStrings {

    static let continueLabel = CivicaText("Continue", es: "Continuar")
    static let backLabel = CivicaText("Back", es: "Atrás")
    static let skipLabel = CivicaText("Skip for now", es: "Omitir por ahora")
    static let notSureLabel = CivicaText("I'm not sure", es: "No estoy seguro")
    static let yesLabel = CivicaText("Yes", es: "Sí")
    static let noLabel = CivicaText("No", es: "No")

    /// "3 of 8" / "3 de 8". The Spanish form mirrors the canvas mockup
    /// (lowercase "de"). Caller passes the active language explicitly
    /// — same pattern as SNAPDecisionMathStrings interpolated helpers.
    static func progressLabel(current: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(current) of \(total)"
        case .spanish: return "\(current) de \(total)"
        }
    }

    /// Verbose form for VoiceOver — reads as a full sentence rather
    /// than two unrelated digits separated by silence.
    static func progressAccessibilityLabel(current: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Question \(current) of \(total)"
        case .spanish: return "Pregunta \(current) de \(total)"
        }
    }
}
