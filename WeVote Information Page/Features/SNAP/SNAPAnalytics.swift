import Foundation
#if canImport(FirebaseAnalytics)
import FirebaseAnalytics
#if canImport(FirebaseCore)
import FirebaseCore
#endif
#endif

// EXPERIMENTAL SILOED MODULE:
// SNAP analytics must NEVER include PII or eligibility answers.
// Allowed payload is limited to coarse navigation metadata only (step name / step index).
enum SNAPAnalytics {
    // Privacy boundary allowlist: analytics payloads may include only coarse flow metadata.
    static let allowedParameterKeys: Set<String> = ["step_name", "step_index"]

    enum Event {
        static let entryViewed = "snap_entry_viewed"
        static let privacyNoticeViewed = "snap_privacy_notice_viewed"
        static let started = "snap_started"
        static let stepCompleted = "snap_step_completed"
        static let reviewViewed = "snap_review_viewed"
        static let nextStepsViewed = "snap_next_steps_viewed"
        static let abandoned = "snap_abandoned"
    }

    static func trackEntryViewed() {
        send(Event.entryViewed, stepName: nil, stepIndex: nil)
    }

    static func trackPrivacyNoticeViewed() {
        send(Event.privacyNoticeViewed, stepName: nil, stepIndex: nil)
    }

    static func trackStarted() {
        send(Event.started, stepName: nil, stepIndex: nil)
    }

    static func trackStepCompleted(step: SNAPDraftStep) {
        send(Event.stepCompleted, stepName: step.analyticsName, stepIndex: step.rawValue + 1)
    }

    static func trackReviewViewed() {
        send(Event.reviewViewed, stepName: SNAPDraftStep.reviewDraft.analyticsName, stepIndex: SNAPDraftStep.reviewDraft.rawValue + 1)
    }

    static func trackNextStepsViewed() {
        send(Event.nextStepsViewed, stepName: SNAPDraftStep.nextSteps.analyticsName, stepIndex: SNAPDraftStep.nextSteps.rawValue + 1)
    }

    static func trackAbandoned(lastStep: SNAPDraftStep) {
        send(Event.abandoned, stepName: lastStep.analyticsName, stepIndex: lastStep.rawValue + 1)
    }

    static func makeParameters(stepName: String?, stepIndex: Int?) -> [String: Any] {
        var params: [String: Any] = [:]
        if let stepName {
            params["step_name"] = stepName
        }
        if let stepIndex {
            params["step_index"] = stepIndex
        }

        // Guardrail: enforce allowlisted analytics keys only.
        return params.filter { allowedParameterKeys.contains($0.key) }
    }

    private static func send(_ event: String, stepName: String?, stepIndex: Int?) {
        let params = makeParameters(stepName: stepName, stepIndex: stepIndex)

        // Privacy boundary: never add free-text answers, demographic details,
        // addresses, ZIP, household size, income, student answers, or identifiers.
        #if canImport(FirebaseAnalytics)
        #if canImport(FirebaseCore)
        guard FirebaseApp.app() != nil else {
            // Firebase is linked but not configured for this build target.
            // Keep SNAP analytics as a no-op to avoid noisy AppMeasurement logs.
            return
        }
        #endif
        Analytics.logEvent(event, parameters: params.isEmpty ? nil : params)
        #else
        // No analytics provider configured: intentionally no-op.
        _ = event
        _ = params
        #endif
    }
}

private extension SNAPDraftStep {
    var analyticsName: String {
        switch self {
        case .whereApplyingFrom: return "where_applying_from"
        case .householdBasics: return "household_basics"
        case .applicantAge: return "applicant_age"
        case .addressContact: return "address_contact"
        case .income: return "income"
        case .studentStatus: return "student_status"
        case .expenses: return "expenses"
        case .documentsChecklist: return "documents_checklist"
        case .reviewDraft: return "review_draft"
        case .nextSteps: return "next_steps"
        }
    }
}
