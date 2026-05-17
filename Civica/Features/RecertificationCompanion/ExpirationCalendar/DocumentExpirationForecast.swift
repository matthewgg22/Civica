import Foundation

// Output of the expiration predictor. Pure value types — no
// dependencies on UIKit or SwiftUI so this file can be unit-tested
// without a host app.

/// One action the user needs to take to keep a document fresh.
struct DocumentExpirationAction: Equatable, Hashable {
    /// Document type the action applies to (e.g. `.proofOfIncome`).
    let document: SNAPDocumentType

    /// What the user should do. Today only `.replace` is generated
    /// (capture a fresh version). The enum is reserved for future
    /// actions like `.confirmUnchanged` (1-tap acknowledgment for
    /// documents that don't change, e.g. immigration status).
    let action: ActionKind

    /// The day by which the user should have done the action so that
    /// the document is still fresh enough at the recertification
    /// interview. Day-precision; UI rounds further if needed.
    let dueBy: Date

    /// Short reason string for the UI. Plain-language, no jargon.
    /// Intentionally a free string here — not a CivicaText — because
    /// the predictor is pure; the caller localizes using the document
    /// type + the standard format, not by reading this back.
    let reason: ReasonCode

    enum ActionKind: String, Codable, Equatable, Hashable {
        case replace
    }

    enum ReasonCode: String, Codable, Equatable, Hashable {
        /// User has never captured this type.
        case missing
        /// Captured but will be older than the state's threshold at
        /// the recert date.
        case staleAtRecert
        /// Captured recently but cadence (biweekly/monthly) says the
        /// user is due for a fresh capture before the recert window.
        case cadenceDue
    }
}

/// Full forecast surface shown to the user. Independent of UI.
struct DocumentExpirationForecast: Equatable {
    /// Sorted ascending by `dueBy`. Empty when nothing needs doing.
    let upcomingActions: [DocumentExpirationAction]

    /// The recert date the forecast is targeting. Echoed back so UI
    /// can show "in N days" without re-deriving it.
    let nextRecertDate: Date

    /// How many of the configured document types are already fresh
    /// enough to satisfy the recert window.
    let documentsReadyForRecert: Int

    /// Count of `upcomingActions` — provided as a flat field for the
    /// summary card so it doesn't have to count the array itself.
    let documentsNeedingReplacement: Int

    /// State code the forecast was computed against. Echoed so the UI
    /// can render the right copy when policy review surfaces edge
    /// cases per state.
    let stateCode: String

    /// True when the state has no rules in the fixture. UI should
    /// show a "we don't have rules for your state yet" empty state
    /// instead of a misleading "you're all set."
    var isStateUnconfigured: Bool {
        !DocumentExpirationRules.isStateConfigured(stateCode)
    }
}
