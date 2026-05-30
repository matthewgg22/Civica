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

    /// True when the returning-user home's primary action should resume
    /// the application by re-entering CivicaSNAPFlowView — the orchestrator
    /// restores the saved section / review / packet step from
    /// SNAPApplicationDraftStore, so the user lands back where they
    /// stopped (the review surface for `.screenerComplete`, an idempotent
    /// re-render of the packet for `.packetGenerated`).
    ///
    /// Only these two pre-submission active-case states actually reach
    /// SNAPReturningUserHomeView: `rootSurface` rules out `.recertDue`,
    /// the two decisions, and everything `isPostSubmission` (which covers
    /// `.documentsRequested` onward) before the `.isActiveCase` branch.
    /// Every other status routes elsewhere first, so resume-into-flow does
    /// not apply to it. CivicaRootView gates its resume navigation on this
    /// predicate — keeping the no-op CTA bug from silently returning.
    var resumesIntoApplicationFlow: Bool {
        switch self {
        case .screenerComplete, .packetGenerated:
            return true
        default:
            return false
        }
    }

    /// True when the Phase 2 (Pending) home's primary CTA should push
    /// the in-app SNAPInterviewCoachView instead of presenting the
    /// generic SNAPWhatHappensNextSheet. Today that's only
    /// `.interviewScheduled` — the highest-attrition moment in the SNAP
    /// application, where coaching the user through a 15–20 minute
    /// phone call is the highest-leverage thing Civica can do.
    ///
    /// JR-3 (audit 2026-05-29): the Phase 2 surface already flipped its
    /// CTA copy to "Prepare for your interview" for this sub-state but
    /// still routed it through the same sheet as every other Phase 2
    /// status. CivicaHomePhase2View.primaryCTA now gates on this
    /// predicate so the copy and the destination stay in lockstep.
    /// SNAPWaitingRoomView's actionBanner used the same in-app coach
    /// for `.interviewScheduled` before this PR; Phase 2 had simply
    /// not inherited the rule when it took over the post-submission
    /// surface from the waiting room.
    var phase2PrimaryCTAPushesInterviewCoach: Bool {
        self == .interviewScheduled
    }
}
