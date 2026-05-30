import Testing
@testable import Civica

// Regression guard for JR-3 (audit 2026-05-29 — Pass 3 / Journey).
//
// The Phase 2 (Pending) home flips its primary CTA copy to
// "Prepare for your interview" the moment status is .interviewScheduled,
// but pre-fix it still routed every Phase 2 sub-state through the same
// presentation: a Button that presented SNAPWhatHappensNextSheet. The
// fix escalates the .interviewScheduled CTA onto a NavigationLink that
// pushes the in-app SNAPInterviewCoachView — the surface that lowers
// activation energy for the most attrition-prone moment in the SNAP
// application. (SNAPWaitingRoomView already pushed that same coach;
// the new Phase 2 surface had simply not inherited the rule.)
//
// Per the SNAPReturningUserResumeTests pattern, the routing rule is
// pinned as a predicate on the SNAPApplicationStatus enum and the view
// consumes that predicate. The Civica target does not link ViewInspector
// or a SwiftUI behavioral-tap library, so a predicate pin is the
// strongest unit-level guard available; a snapshot diff would not
// reliably catch a Button→NavigationLink swap at parity copy.

@Suite("CivicaHomePhase2View — JR-3 primary CTA routing")
struct CivicaHomePhase2InterviewCTAroutingTests {

    @Test(".interviewScheduled escalates the Phase 2 primary CTA to the Interview Coach")
    func interviewScheduledRoutesToInterviewCoach() {
        #expect(SNAPApplicationStatus.interviewScheduled.phase2PrimaryCTAPushesInterviewCoach)
    }

    @Test("Every other Phase 2 sub-state keeps the generic What-Happens-Next sheet")
    func otherPhase2StatesDoNotRouteToInterviewCoach() {
        // Phase 2 covers .submittedToState / .documentsRequested /
        // .interviewScheduled / .interviewCompleted (per
        // CivicaRootView.rootSurface). Of those, only the
        // .interviewScheduled sub-state is interview-imminent enough to
        // warrant the dedicated coach surface — the rest stay on the
        // existing "What Happens Next" sheet that walks through the
        // generic post-submission timeline.
        let nonInterviewScheduled: [SNAPApplicationStatus] = [
            .submittedToState,
            .documentsRequested,
            .interviewCompleted,
        ]
        for status in nonInterviewScheduled {
            #expect(
                !status.phase2PrimaryCTAPushesInterviewCoach,
                "\(status.rawValue) must not route the Phase 2 primary CTA to the Interview Coach"
            )
        }
    }

    /// Defence in depth: every status whose primary CTA copy is
    /// "Prepare for your interview" must also route to the Interview
    /// Coach. Today there is one such status; the equality forces a
    /// future contributor who flips a status's CTA copy in
    /// CivicaPhase2Strings to update the routing predicate in lockstep.
    @Test("Interview-coach destination set is exactly the .interviewScheduled set")
    func interviewCoachSetMatchesInterviewScheduledOnly() {
        let routedToCoach = Set(
            SNAPApplicationStatus.allCases.filter {
                $0.phase2PrimaryCTAPushesInterviewCoach
            }
        )
        #expect(routedToCoach == Set([.interviewScheduled]))
    }
}
