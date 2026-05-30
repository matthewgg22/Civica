import Testing
@testable import Civica

// Regression guard for the no-op "resume" CTA bug on the returning-user
// home (fix 2026-05-30).
//
// CivicaRootView's `.isActiveCase` branch built SNAPReturningUserHomeView
// with an empty `onResume: {}` closure, so its primary button
// ("Generate your application packet" / "Submit to {state}") did nothing —
// a returning user mid-application could not advance. The fix routes
// resume through `SNAPApplicationStatus.resumesIntoApplicationFlow`:
// CivicaRootView only pushes CivicaSNAPFlowView when that predicate is
// true. Pinning the predicate here means gutting resume back toward a
// no-op (predicate -> all-false) fails CI.
//
// Coverage note: the project links only pointfree SnapshotTesting (no
// ViewInspector), so a SwiftUI button tap cannot be invoked in a unit
// test, and a snapshot cannot see an empty closure (identical pixels).
// Pinning the load-bearing predicate is the best available unit-level
// guard; a returning-user-home snapshot is deferred to the IA-6 / JR-6
// follow-ups (which record PNG baselines).

@Suite("SNAPReturningUser resume routing")
struct SNAPReturningUserResumeTests {

    /// The two — and only two — statuses that actually render
    /// SNAPReturningUserHomeView's primary button. Everything else is
    /// routed away by an earlier branch of CivicaRootView.rootSurface
    /// (recertDue, the decisions, and all of isPostSubmission, which
    /// covers .documentsRequested onward).
    @Test("Reachable active-case states resume into the application flow")
    func reachableActiveCaseStatesResume() {
        #expect(SNAPApplicationStatus.screenerComplete.resumesIntoApplicationFlow)
        #expect(SNAPApplicationStatus.packetGenerated.resumesIntoApplicationFlow)
    }

    @Test("Statuses that never render that surface do not resume into the flow")
    func nonResumableStatesDoNotResume() {
        let nonResumable: [SNAPApplicationStatus] = [
            .notStarted,
            .screenerInProgress,
            .submittedToState,
            .documentsRequested,
            .interviewScheduled,
            .interviewCompleted,
            .decisionApproved,
            .decisionDenied,
            .recertDue,
        ]
        for status in nonResumable {
            #expect(
                !status.resumesIntoApplicationFlow,
                "\(status.rawValue) must not trigger a resume push from the returning-user home"
            )
        }
    }

    /// Ties the predicate to the routing rule so the two cannot drift.
    /// A status reaches the returning-user home iff it is `isActiveCase`
    /// but is not routed away first — i.e. NOT `isPostSubmission` and not
    /// `.recertDue` (decisions are already excluded by `isActiveCase`).
    /// If a future change to `isActiveCase` / `isPostSubmission` shifts
    /// which statuses land on this surface, this assertion forces
    /// `resumesIntoApplicationFlow` to be updated in lockstep.
    @Test("Resumable set is exactly the set that reaches the returning-user home")
    func resumableSetMatchesRoutableSet() {
        let reachesReturningHome = Set(
            SNAPApplicationStatus.allCases.filter {
                $0.isActiveCase && !$0.isPostSubmission && $0 != .recertDue
            }
        )
        let resumable = Set(
            SNAPApplicationStatus.allCases.filter { $0.resumesIntoApplicationFlow }
        )
        #expect(resumable == reachesReturningHome)
        #expect(reachesReturningHome == Set([.screenerComplete, .packetGenerated]))
    }
}
