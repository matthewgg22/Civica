import Foundation
import os

// EXPERIMENTAL SILOED MODULE: privacy-conscious analytics scaffolding
// for the Interview Coach.
//
// Why this exists separately from SNAPAnalytics:
//   SNAPAnalytics.swift is in the Civica target's
//   PBXFileSystemSynchronizedBuildFileExceptionSet membership list --
//   excluded from the build alongside the rest of the legacy step-by-
//   step SNAP application. Until that file is either pulled into the
//   target or replaced by a CivicaAnalytics module, InterviewCoach
//   stands up its own thin scaffolding.
//
// Backend today: os.Logger only. No Firebase, no Mixpanel, no network
// exfiltration. When a real analytics provider lands (Firebase,
// PostHog, etc.) it gets plugged in at the `track(_:parameters:)`
// implementation site below; call sites in the views don't change.
//
// Privacy boundary (mirrors SNAPAnalytics):
// - Closed-set event names only (the Event enum below).
// - Parameter VALUES must be closed-set categorical strings -- state
//   codes, scenario rawValues, score buckets ("low"/"mid"/"high").
// - Parameter KEYS must be on the allowedParameterKeys allowlist;
//   off-list keys are dropped with a dev warning.
// - NEVER pass transcripts, user utterances, AI-generated text,
//   question IDs, or anything that could re-identify a session or
//   re-derive what the user said. Question IDs are intentionally
//   omitted from the allowlist because individual MA questions can
//   be linked back to specific household / immigration / disability
//   situations and that's a finer grain than we want in analytics.
enum InterviewCoachAnalytics {

    enum Event: String {
        case entryViewed             = "interview_coach_entry_viewed"
        case browserViewed           = "interview_coach_browser_viewed"
        case questionDetailViewed    = "interview_coach_question_detail_viewed"
        case crossLinkTapped         = "interview_coach_cross_link_tapped"
        case sessionStarted          = "interview_coach_session_started"
        case sessionTurnSent         = "interview_coach_session_turn_sent"
        case sessionFailed           = "interview_coach_session_failed"
        case sessionCompleted        = "interview_coach_session_completed"
        case feedbackRequested       = "interview_coach_feedback_requested"
        case feedbackViewed          = "interview_coach_feedback_viewed"
        case retryTapped             = "interview_coach_retry_tapped"
    }

    private static let allowedParameterKeys: Set<String> = [
        "state_code",
        "scenario",
        "category",
        "archetype",
        "persona",
        "language",
        "turn_count",
        "axis_completeness",
        "axis_accuracy_risk",
        "axis_missing_context",
    ]

    private static let logger = Logger(subsystem: "Civica", category: "InterviewCoachAnalytics")

    static func track(_ event: Event, parameters: [String: String] = [:]) {
        let dropped = parameters.keys.filter { !allowedParameterKeys.contains($0) }
        if !dropped.isEmpty {
            // Dev-only signal that an off-allowlist key was passed. The
            // KEY name is logged (it's on the developer's source); the
            // VALUE is never logged.
            logger.warning("Dropped off-allowlist parameter keys for \(event.rawValue, privacy: .public): \(dropped.joined(separator: ", "), privacy: .public)")
        }

        let safe = parameters.filter { allowedParameterKeys.contains($0.key) }

        if safe.isEmpty {
            logger.info("\(event.rawValue, privacy: .public)")
        } else {
            let kv = safe.sorted(by: { $0.key < $1.key })
                .map { "\($0.key)=\($0.value)" }
                .joined(separator: ", ")
            logger.info("\(event.rawValue, privacy: .public) [\(kv, privacy: .public)]")
        }
    }

    // Buckets a 0.0-1.0 score into a closed-set categorical value so
    // analytics never gets a continuous-valued payload. Three buckets
    // are coarse enough that low-volume cohorts can't be de-anonymized
    // via score patterns.
    static func bucket(_ value: Double) -> String {
        if value < 0.34 { return "low" }
        if value < 0.67 { return "mid" }
        return "high"
    }

    static func languageCode(_ language: CivicaLanguage) -> String {
        switch language {
        case .english: return "en"
        case .spanish: return "es"
        }
    }
}
