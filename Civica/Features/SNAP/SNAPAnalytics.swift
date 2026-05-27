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
    // `topic` is added for the conversation flow so we can see which question
    // topics users abandon on, without ever logging the user utterance or the
    // assistant's generated question text. `topic` values come from the
    // backend QuestionTopic enum, which is itself a closed set of strings.
    static let allowedParameterKeys: Set<String> = ["step_name", "step_index", "topic"]

    enum Event {
        static let entryViewed = "snap_entry_viewed"
        static let privacyNoticeViewed = "snap_privacy_notice_viewed"
        static let started = "snap_started"
        static let stepCompleted = "snap_step_completed"
        static let reviewViewed = "snap_review_viewed"
        static let nextStepsViewed = "snap_next_steps_viewed"
        static let abandoned = "snap_abandoned"
        // Conversation-flow events. Track that a turn happened, not its content.
        static let conversationTurnSent = "snap_conversation_turn_sent"
        static let conversationVerdictReached = "snap_conversation_verdict_reached"
        static let conversationClarificationRequested = "snap_conversation_clarification_requested"
        static let conversationConfirmationRequested = "snap_conversation_confirmation_requested"
        static let conversationError = "snap_conversation_error"
        // Interview Navigator funnel. Counts only — never includes
        // the actual date, phone number, or consent timestamp.
        static let interviewDateSet = "snap_interview_date_set"
        static let interviewPrepViewed = "snap_interview_prep_viewed"
        static let tcpaConsentGranted = "snap_tcpa_consent_granted"
        static let interview24hNotificationScheduled = "snap_interview_24h_notification_scheduled"
        // Enrollment API persistence events — no PII, no eligibility result.
        static let packetSubmitted = "snap_packet_submitted"
        // Re-entry assist (Unrath retention pillar, G2) — counts only,
        // never the prior packet_id, county, or any household detail.
        static let reEntryCardImpression = "snap_reentry_card_impression"
        static let reEntryConfirmed = "snap_reentry_confirmed"
        static let reEntryDismissed = "snap_reentry_dismissed"
        static let reEntryError = "snap_reentry_error"
    }

    /// Track a single conversation turn. `topic` is the QuestionTopic the
    /// backend Ask-Selector picked — closed-set values only, no free text.
    static func trackConversationTurnSent(topic: String) {
        send(Event.conversationTurnSent, stepName: nil, stepIndex: nil, topic: topic)
    }

    /// Track that the conversation reached a terminal eligibility verdict.
    /// `verdict` is one of "eligible", "ineligible", "eligible_with_conditions",
    /// or "insufficient_information" — passed via the topic slot since it's
    /// the only allowlisted free-form key.
    static func trackConversationVerdictReached(verdict: String) {
        send(Event.conversationVerdictReached, stepName: nil, stepIndex: nil, topic: verdict)
    }

    static func trackConversationClarificationRequested() {
        send(Event.conversationClarificationRequested, stepName: nil, stepIndex: nil)
    }

    static func trackConversationConfirmationRequested() {
        send(Event.conversationConfirmationRequested, stepName: nil, stepIndex: nil)
    }

    static func trackConversationError() {
        send(Event.conversationError, stepName: nil, stepIndex: nil)
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

    // MARK: - Interview Navigator funnel

    static func trackInterviewDateSet() {
        send(Event.interviewDateSet, stepName: nil, stepIndex: nil)
    }

    static func trackInterviewPrepViewed() {
        send(Event.interviewPrepViewed, stepName: nil, stepIndex: nil)
    }

    static func trackSubmitted() {
        send(Event.packetSubmitted, stepName: nil, stepIndex: nil)
    }

    static func trackTCPAConsentGranted() {
        send(Event.tcpaConsentGranted, stepName: nil, stepIndex: nil)
    }

    static func trackInterview24hNotificationScheduled() {
        send(Event.interview24hNotificationScheduled, stepName: nil, stepIndex: nil)
    }

    // MARK: - Re-entry assist (Unrath retention pillar, G2)

    /// Card surfaced to the applicant (state became .candidate). Fires once
    /// per appearance — the store de-dupes via state-machine transitions.
    static func trackReEntryCardImpression() {
        send(Event.reEntryCardImpression, stepName: nil, stepIndex: nil)
    }

    /// User confirmed re-enrollment. `idempotent` distinguishes a freshly
    /// created Draft ("new") from a pre-existing one returned by the
    /// gateway's idempotency branch ("existing"). Encoded into `topic`
    /// since it's the only allowlisted free-form key.
    static func trackReEntryConfirmed(idempotent: Bool) {
        send(
            Event.reEntryConfirmed,
            stepName: nil,
            stepIndex: nil,
            topic: idempotent ? "existing" : "new"
        )
    }

    /// User tapped "Not now" on the card.
    static func trackReEntryDismissed() {
        send(Event.reEntryDismissed, stepName: nil, stepIndex: nil)
    }

    /// Failure surfaced to the user. `stage` is "load" (suggestion fetch
    /// failed) or "enroll" (POST re-enroll-from failed). Encoded via topic.
    static func trackReEntryError(stage: String) {
        send(Event.reEntryError, stepName: nil, stepIndex: nil, topic: stage)
    }

    static func makeParameters(
        stepName: String?,
        stepIndex: Int?,
        topic: String? = nil
    ) -> [String: Any] {
        var params: [String: Any] = [:]
        if let stepName {
            params["step_name"] = stepName
        }
        if let stepIndex {
            params["step_index"] = stepIndex
        }
        if let topic {
            params["topic"] = topic
        }

        // Guardrail: enforce allowlisted analytics keys only.
        return params.filter { allowedParameterKeys.contains($0.key) }
    }

    private static func send(
        _ event: String,
        stepName: String?,
        stepIndex: Int?,
        topic: String? = nil
    ) {
        let params = makeParameters(stepName: stepName, stepIndex: stepIndex, topic: topic)

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
