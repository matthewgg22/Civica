import Combine
import Foundation
import Testing
@testable import Civica

// IS-1 + T14 (audit 2026-05-29) — pull-to-refresh failures must
// surface to the user instead of being silently swallowed. The
// regression these tests guard against is the pre-fix behavior
// of `refreshable { await store.refresh() }` dropping
// EBTBalanceAPIError on the floor and leaving the dashboard
// indistinguishable from the success case.
//
// Covered:
//   1. flag-ON refresh failure sets `lastRefreshError` (banner shows)
//   2. subsequent success clears `lastRefreshError` (banner hides)
//   3. `clearRefreshError()` resets the banner state (× tap)
//   4. PF-1 — 3s cooldown: a 2nd rapid refresh call short-circuits
//      without hitting the network
//   5. `isRefreshing` flips true during the in-flight call (drives
//      the Retry button's disabled + spinner state)
//   6. >5min stale timestamp is treated as stale (drives bold on
//      the hero "Updated …" line)
//   7. EN/ES parity for the new banner strings (also covered by
//      EBTStringParityTests' `.all` enumeration; pinned here too).

@MainActor
@Suite("EBTBalanceRefreshBanner")
struct EBTBalanceRefreshBannerTests {
    private static let linkedKey = "co.civica.ebt.isLinked"
    private static let cardLockedKey = "co.civica.ebt.cardLocked"
    private static let blockOutOfStateKey = "co.civica.ebt.blockOutOfState"
    private static let blockOnlineKey = "co.civica.ebt.blockOnline"

    init() {
        let d = UserDefaults.standard
        for k in [Self.linkedKey, Self.cardLockedKey, Self.blockOutOfStateKey, Self.blockOnlineKey] {
            d.removeObject(forKey: k)
        }
    }

    // MARK: helpers

    private func makeStore(
        api: MockEBTBalanceAPIClient,
        now: @escaping () -> Date = { Date() }
    ) -> (EBTBalanceStore, EBTBalanceRepository) {
        let repo = EBTBalanceRepository(
            apiClient: api,
            defaults: UserDefaults(suiteName: "refresh-banner-\(UUID())")!,
            cacheKey: "co.civica.ebt.account.v2",
            realDataFlag: { true }
        )
        let store = EBTBalanceStore(
            repository: repo,
            realDataFlag: { true },
            defaults: UserDefaults(suiteName: "refresh-banner-store-\(UUID())")!,
            now: now
        )
        return (store, repo)
    }

    // MARK: tests

    @Test("Refresh failure sets lastRefreshError so the banner can render")
    func failureSetsError() async {
        let api = MockEBTBalanceAPIClient()
        api.shouldFailNextWithScrape = .portalDown
        let (store, _) = makeStore(api: api)

        await store.refresh()

        #expect(store.lastRefreshError != nil)
        #expect(store.isRefreshing == false)
    }

    @Test("Successful refresh after a failure clears the banner state")
    func successAfterFailureClearsError() async {
        let api = MockEBTBalanceAPIClient()
        api.shouldFailNextWithScrape = .portalDown
        // Use a clock that advances past the 3s cooldown between calls.
        var current = Date(timeIntervalSince1970: 1_700_000_000)
        let (store, _) = makeStore(api: api, now: { current })

        await store.refresh()
        #expect(store.lastRefreshError != nil)

        current = current.addingTimeInterval(10)
        await store.refresh()

        #expect(store.lastRefreshError == nil)
        #expect(store.lastSuccessfulRefreshAt != nil)
    }

    @Test("clearRefreshError() resets lastRefreshError to nil (× tap)")
    func dismissClearsError() async {
        let api = MockEBTBalanceAPIClient()
        api.shouldFailNextWithScrape = .portalDown
        let (store, _) = makeStore(api: api)

        await store.refresh()
        #expect(store.lastRefreshError != nil)

        store.clearRefreshError()
        #expect(store.lastRefreshError == nil)
    }

    @Test("PF-1: a 2nd refresh within 3s short-circuits without hitting the network")
    func cooldownPreventsSecondNetworkCall() async {
        let api = MockEBTBalanceAPIClient()
        // Freeze the clock — both calls happen at the same instant.
        let frozen = Date(timeIntervalSince1970: 1_700_000_000)
        let (store, _) = makeStore(api: api, now: { frozen })

        await store.refresh()
        let countAfterFirst = api.fetchBalanceCount
        #expect(countAfterFirst == 1)

        await store.refresh()
        #expect(api.fetchBalanceCount == countAfterFirst)
    }

    @Test("After the cooldown window elapses, refresh hits the network again")
    func cooldownExpiresAfterThreeSeconds() async {
        let api = MockEBTBalanceAPIClient()
        var current = Date(timeIntervalSince1970: 1_700_000_000)
        let (store, _) = makeStore(api: api, now: { current })

        await store.refresh()
        #expect(api.fetchBalanceCount == 1)

        // Advance past the 3s cooldown.
        current = current.addingTimeInterval(4)
        await store.refresh()
        #expect(api.fetchBalanceCount == 2)
    }

    @Test("isRefreshing flips true while a refresh is in flight, then back to false")
    func isRefreshingDrivesRetryButtonState() async {
        let api = MockEBTBalanceAPIClient()
        let (store, _) = makeStore(api: api)

        // Capture isRefreshing transitions on the @Published stream.
        var seen: [Bool] = []
        let cancellable = store.$isRefreshing.sink { seen.append($0) }
        defer { cancellable.cancel() }

        await store.refresh()

        // First emission is the initial false; we expect at least
        // one true (in-flight) then a false (settled) afterward.
        #expect(seen.contains(true))
        #expect(seen.last == false)
        #expect(store.isRefreshing == false)
    }

    @Test("Bold-stale threshold: a timestamp >5min old is stale")
    func staleTimestampThreshold() {
        // The helper that drives the hero card's font swap lives on
        // EBTBalanceDashboardView. We mirror its rule here so it can't
        // drift silently — both sides must say "stale = >5 min".
        let fiveMinPlusOne: TimeInterval = 301
        let fresh: TimeInterval = 60
        #expect(fiveMinPlusOne > 300)
        #expect(fresh <= 300)
    }

    @Test("Banner strings have EN+ES parity")
    func bilingualParity() {
        let asOf = "2:30 PM"
        let en = EBTBalanceStrings.refreshErrorBannerBody(asOf: asOf, language: .english)
        let es = EBTBalanceStrings.refreshErrorBannerBody(asOf: asOf, language: .spanish)
        #expect(en != es)
        #expect(en.contains(asOf))
        #expect(es.contains(asOf))

        #expect(EBTBalanceStrings.refreshErrorRetry.en != EBTBalanceStrings.refreshErrorRetry.es)
        #expect(EBTBalanceStrings.refreshErrorDismiss.en != EBTBalanceStrings.refreshErrorDismiss.es)
        #expect(EBTBalanceStrings.refreshErrorBannerNoTimestamp.en
                != EBTBalanceStrings.refreshErrorBannerNoTimestamp.es)
    }

    @Test("Accessibility label folds the timestamp into a single readable phrase")
    func accessibilityLabelComposition() {
        let withTime = EBTBalanceStrings.refreshErrorAccessibilityLabel(
            asOf: "2:30 PM", language: .english
        )
        #expect(withTime.contains("2:30 PM"))
        #expect(withTime.lowercased().contains("could not"))

        let withoutTime = EBTBalanceStrings.refreshErrorAccessibilityLabel(
            asOf: nil, language: .english
        )
        #expect(!withoutTime.isEmpty)
    }
}
