import Combine
import Foundation
import Testing
@testable import Civica

// Phase 2 / Lane G — EBTAnomalyStore tests.
//
// Coverage:
//   - Store subscribes to repository.$account; rescores on change
//   - dismiss(_:) removes the alert from activeAlerts
//   - enableTravelMute() persists travelMuteUntil to UserDefaults
//   - enableTravelMute() immediately clears cross-state alerts
//
// EBTAnomalyStore is @MainActor; tests are also @MainActor so they
// can synchronously observe @Published changes without async complexity.

@MainActor
@Suite("EBTAnomalyStore")
struct EBTAnomalyStoreTests {

    // MARK: - Helpers

    private func makeRepo(
        suiteID: String = UUID().uuidString
    ) -> (EBTBalanceRepository, MockEBTBalanceAPIClient) {
        let client = MockEBTBalanceAPIClient()
        let defaults = UserDefaults(suiteName: "anomaly-store-test-\(suiteID)")!
        let repo = EBTBalanceRepository(
            apiClient: client,
            defaults: defaults,
            cacheKey: "test-ebt-account"
        )
        return (repo, client)
    }

    /// Inject a single OXXO purchase into the repository's account directly.
    private func injectCrossStateAccount(into repo: EBTBalanceRepository) {
        let crossStateTxn = EBTTransaction(
            id: UUID(),
            merchant: "OXXO #4488",
            amount: -Decimal(1200) / 100,
            date: Date(),
            category: .other
        )
        let account = EBTAccount(
            foodBalance: 50,
            cashBalance: nil,
            lastUpdated: Date(),
            nextDeposit: nil,
            depositDayOfMonth: 5,
            transactions: [crossStateTxn]
        )
        repo.overrideAccount(account)
    }

    // MARK: - Repository subscription

    @Test("Store starts with empty alerts when repository has no account")
    func startsEmpty() {
        let (repo, _) = makeRepo()
        let store = EBTAnomalyStore(repository: repo)
        #expect(store.activeAlerts.isEmpty)
    }

    @Test("Store rescores when repository account changes to cross-state transactions")
    func rescoresOnAccountUpdate() async {
        let (repo, _) = makeRepo()
        let store = EBTAnomalyStore(repository: repo)
        #expect(store.activeAlerts.isEmpty)

        // Inject an account with an OXXO transaction.
        injectCrossStateAccount(into: repo)

        // Yield to RunLoop so the Combine sink fires.
        await Task.yield()

        #expect(store.activeAlerts.contains { $0.kind == .crossStateUse },
                "Expected a cross-state alert after account update")
    }

    @Test("Store clears alerts when repository account becomes nil")
    func clearsAlertsOnNilAccount() async {
        let (repo, _) = makeRepo()
        let store = EBTAnomalyStore(repository: repo)

        injectCrossStateAccount(into: repo)
        await Task.yield()
        #expect(!store.activeAlerts.isEmpty)

        repo.overrideAccount(nil)
        await Task.yield()
        #expect(store.activeAlerts.isEmpty)
    }

    // MARK: - dismiss(_:)

    @Test("dismiss(_:) removes the alert from activeAlerts")
    func dismissRemovesAlert() async {
        let (repo, _) = makeRepo()
        let store = EBTAnomalyStore(repository: repo)

        injectCrossStateAccount(into: repo)
        await Task.yield()

        guard let alert = store.activeAlerts.first else {
            #expect(Bool(false), "No alerts to dismiss")
            return
        }

        store.dismiss(alert)
        #expect(!store.activeAlerts.contains { $0.id == alert.id })
    }

    @Test("dismiss(_:) with unknown alert is a no-op")
    func dismissUnknownAlertNoop() async {
        let (repo, _) = makeRepo()
        let store = EBTAnomalyStore(repository: repo)
        injectCrossStateAccount(into: repo)
        await Task.yield()
        let countBefore = store.activeAlerts.count

        let ghost = EBTAnomalyAlert(
            id: UUID(),
            kind: .velocityBurst,
            severity: .high,
            transactions: [],
            bannerCopy: EBTAnomalyStrings.velocityBannerCopy,
            cta: .lockCard
        )
        store.dismiss(ghost)
        #expect(store.activeAlerts.count == countBefore)
    }

    // MARK: - Travel mute

    @Test("enableTravelMute persists travelMuteUntil to UserDefaults")
    func travelMutePersists() async {
        let suiteID = UUID().uuidString
        let defaults = UserDefaults(suiteName: "anomaly-store-test-\(suiteID)")!
        let (repo, _) = makeRepo(suiteID: suiteID)
        let store = EBTAnomalyStore(repository: repo, defaults: defaults)

        store.enableTravelMute(days: 30)

        let stored = defaults.object(forKey: EBTAnomalyStore.travelMuteKey) as? Date
        #expect(stored != nil)
        // Mute should be ~30 days from now (within a minute of tolerance).
        let expected = Date().addingTimeInterval(30 * 86_400)
        let diff = abs((stored?.timeIntervalSince(expected)) ?? 999)
        #expect(diff < 60, "Stored mute date too far from expected: diff=\(diff)")
    }

    @Test("enableTravelMute immediately clears cross-state alerts")
    func travelMuteClearsCrossStateAlerts() async {
        let (repo, _) = makeRepo()
        let store = EBTAnomalyStore(repository: repo)

        injectCrossStateAccount(into: repo)
        await Task.yield()
        #expect(store.activeAlerts.contains { $0.kind == .crossStateUse })

        store.enableTravelMute(days: 30)
        #expect(!store.activeAlerts.contains { $0.kind == .crossStateUse },
                "Travel mute should clear cross-state alerts synchronously")
    }

    @Test("travelMuteUntil is restored from UserDefaults on init")
    func travelMuteRestoredFromDefaults() {
        let suiteID = UUID().uuidString
        let defaults = UserDefaults(suiteName: "anomaly-store-test-\(suiteID)")!
        let future = Date().addingTimeInterval(10 * 86_400)
        defaults.set(future, forKey: EBTAnomalyStore.travelMuteKey)

        let (repo, _) = makeRepo(suiteID: suiteID)
        let store = EBTAnomalyStore(repository: repo, defaults: defaults)

        #expect(store.travelMuteUntil != nil)
        let diff = abs((store.travelMuteUntil?.timeIntervalSince(future)) ?? 999)
        #expect(diff < 1)
    }

    @Test("Stale (past) travel mute is discarded on init")
    func staleTravelMuteDiscarded() {
        let suiteID = UUID().uuidString
        let defaults = UserDefaults(suiteName: "anomaly-store-test-\(suiteID)")!
        let past = Date().addingTimeInterval(-24 * 3600) // yesterday
        defaults.set(past, forKey: EBTAnomalyStore.travelMuteKey)

        let (repo, _) = makeRepo(suiteID: suiteID)
        let store = EBTAnomalyStore(repository: repo, defaults: defaults)

        #expect(store.travelMuteUntil == nil, "Past mute should be discarded")
    }
}
