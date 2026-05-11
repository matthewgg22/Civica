import Foundation

// What stage of the SNAP application a user is in. Drives Civica root
// view's routing — first-time users go to SNAPEntryView; in-progress
// users go to ReturningUserHome; post-submission users go to the
// WaitingRoom (HANDOFF board 24).
//
// v1: status advances on user action. v1.5 will add automated state-
// portal polling to detect documentsRequested / interviewScheduled
// / decisionApproved without user input.

enum SNAPApplicationStatus: String, Codable, CaseIterable, Sendable {
    /// No active application; first-time entry or after explicit "start over".
    case notStarted = "not_started"

    /// User is mid-conversation with the screener.
    case screenerInProgress = "screener_in_progress"

    /// Screener returned an eligibility verdict; ready to generate packet.
    case screenerComplete = "screener_complete"

    /// Application PDF has been generated; user has not yet confirmed
    /// they submitted to DTA Connect.
    case packetGenerated = "packet_generated"

    /// User confirmed they submitted to the state portal. Now waiting
    /// on the state agency (HANDOFF board 24 "the waiting room").
    case submittedToState = "submitted_to_state"

    /// State has asked for additional verification (paystub, lease, ID).
    case documentsRequested = "documents_requested"

    /// State has scheduled the eligibility interview.
    case interviewScheduled = "interview_scheduled"

    /// User has completed the interview; awaiting final decision.
    case interviewCompleted = "interview_completed"

    /// State approved the application.
    case decisionApproved = "decision_approved"

    /// State denied the application.
    case decisionDenied = "decision_denied"

    /// Recertification is due within the policy window (~30 days out).
    case recertDue = "recert_due"

    // MARK: - Convenience predicates used by routing logic

    /// True for any status past the screener but before final decision.
    /// Routes to SNAPReturningUserHomeView / SNAPWaitingRoomView.
    var isActiveCase: Bool {
        switch self {
        case .notStarted, .screenerInProgress, .decisionApproved, .decisionDenied:
            return false
        case .screenerComplete, .packetGenerated, .submittedToState,
             .documentsRequested, .interviewScheduled, .interviewCompleted,
             .recertDue:
            return true
        }
    }

    /// True once user has self-reported submission to DTA Connect.
    /// Drives the waiting-room surface vs the "you need to submit" surface.
    var isPostSubmission: Bool {
        switch self {
        case .submittedToState, .documentsRequested, .interviewScheduled,
             .interviewCompleted, .decisionApproved, .decisionDenied:
            return true
        default:
            return false
        }
    }
}
