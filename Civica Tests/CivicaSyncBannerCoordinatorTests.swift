import Foundation
import Testing
@testable import Civica

// IS-2 (audit 2026-05-29) — coordinated sync-degraded banner.
// Covered:
//   1. single store failure → banner stays hidden (threshold = 2)
//   2. 2 store failures within 10s → banner shows
//   3. 2 failures spaced >10s apart → banner stays hidden (rolling window)
//   4. NWPath transitions to .unsatisfied → banner shows
//   5. Network offline holds the banner up even after a store success
//   6. Dismiss hides + persists for the session
//   7. New coordinator instance resets dismissal (next launch)

@MainActor
@Suite("CivicaSyncBannerCoordinator")
struct CivicaSyncBannerCoordinatorTests {

    /// Mutable clock seam so tests can advance `now()` without sleeping.
    private final class Clock {
        var now: Date
        init(_ start: Date = Date(timeIntervalSince1970: 1_700_000_000)) {
            self.now = start
        }
    }

    private func makeCoordinator(clock: Clock) -> CivicaSyncBannerCoordinator {
        CivicaSyncBannerCoordinator(
            failureWindow: 10,
            failureThreshold: 2,
            now: { clock.now },
            startPathMonitor: false
        )
    }

    @Test("single store failure does not surface the banner")
    func singleFailureNoBanner() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.registerStoreFailure()
        #expect(coord.shouldShow == false)
    }

    @Test("two store failures within 10s surface the banner")
    func twoFailuresWithinWindow() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.registerStoreFailure()
        clock.now = clock.now.addingTimeInterval(5)
        coord.registerStoreFailure()
        #expect(coord.shouldShow == true)
    }

    @Test("two failures spaced beyond the 10s window do not surface")
    func twoFailuresOutsideWindow() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.registerStoreFailure()
        clock.now = clock.now.addingTimeInterval(20)
        coord.registerStoreFailure()
        #expect(coord.shouldShow == false)
    }

    @Test("NWPath becoming unsatisfied surfaces the banner")
    func offlineSurfacesBanner() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.handlePathUpdate(satisfied: false)
        #expect(coord.shouldShow == true)
    }

    @Test("store success while offline does not hide the banner")
    func offlineHoldsBannerThroughSuccess() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.handlePathUpdate(satisfied: false)
        #expect(coord.shouldShow == true)
        coord.registerStoreSuccess()
        #expect(coord.shouldShow == true, "offline path must keep banner up regardless of store success")
    }

    @Test("store success while online clears the banner")
    func onlineSuccessClearsBanner() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.registerStoreFailure()
        clock.now = clock.now.addingTimeInterval(2)
        coord.registerStoreFailure()
        #expect(coord.shouldShow == true)
        coord.registerStoreSuccess()
        #expect(coord.shouldShow == false)
    }

    @Test("dismiss hides the banner and persists for the session")
    func dismissPersists() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.registerStoreFailure()
        clock.now = clock.now.addingTimeInterval(1)
        coord.registerStoreFailure()
        #expect(coord.shouldShow == true)

        coord.dismiss()
        #expect(coord.shouldShow == false)
        #expect(coord.dismissedThisSession == true)

        // Subsequent failures within the same session must not
        // re-surface the banner.
        clock.now = clock.now.addingTimeInterval(1)
        coord.registerStoreFailure()
        clock.now = clock.now.addingTimeInterval(1)
        coord.registerStoreFailure()
        #expect(coord.shouldShow == false, "dismissal must hold for the session")

        // Same goes for the offline path.
        coord.handlePathUpdate(satisfied: false)
        #expect(coord.shouldShow == false, "dismissal must hold across offline transitions")
    }

    @Test("a fresh coordinator instance resets dismissal (next launch)")
    func freshInstanceResetsDismissal() {
        let clock = Clock()
        let coord = makeCoordinator(clock: clock)
        coord.registerStoreFailure()
        coord.registerStoreFailure()
        coord.dismiss()
        #expect(coord.dismissedThisSession == true)

        // Simulate next launch — `@StateObject` reinitializes the view's
        // coordinator, so a fresh instance starts with dismissal cleared.
        let next = makeCoordinator(clock: clock)
        #expect(next.dismissedThisSession == false)
        #expect(next.shouldShow == false)
        next.handlePathUpdate(satisfied: false)
        #expect(next.shouldShow == true, "next-launch instance must be free to surface again")
    }
}
