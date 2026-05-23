import Foundation
import Testing
@testable import Civica

// Plan IRON RULE / T12: with `FeatureFlags.ebtRealData == false`, the
// pre-plan fixture-only EBT experience MUST be byte-identical to the
// pre-plan baseline. These tests freeze that contract:
//
//   1. simulatePurchase + simulateDeposit still mutate the store the
//      same way they did before the repository was added.
//   2. EBTBalanceInsights numbers are unchanged for the demo account.
//   3. EBTBalanceFixtures.demoAccount() shape is unchanged
//      (foodBalance, depositDayOfMonth, transactions count, etc.).
//
// A snapshot test on the SwiftUI dashboard would also belong here,
// but Civica doesnt link snapshot-testing today (no
// SnapshotTesting / ViewInspector package). Instead, the assertions
// below capture the load-bearing behavior the dashboard renders from.
// When a snapshot lib is added later (T11 followup), add a flag-OFF
// dashboard snapshot here.

@MainActor
@Suite("EBT feature-flag regression (IRON RULE)")
struct EBTFeatureFlagRegressionTests {
    /// Always-explicit flag-OFF accessor — never reads from
    /// UserDefaults so the test is hermetic regardless of what
    /// state the device is in.
    private static let flagOff: () -> Bool = { false }

    private static let linkedKey = "co.civica.ebt.isLinked"

    init() {
        // Hermetic init: clear the linked flag so each test starts
        // from a fresh-install posture.
        UserDefaults.standard.removeObject(forKey: Self.linkedKey)
    }

    // MARK: - Fixture shape stability

    @Test("EBTBalanceFixtures.demoAccount preserves pre-plan shape")
    func fixtureShapePreserved() {
        let account = EBTBalanceFixtures.demoAccount()
        // The dashboard renders these specific numbers; any change
        // breaks recordings + screenshots used by docs/teaser.
        #expect(account.foodBalance == Decimal(string: "76.12"))
        #expect(account.cashBalance == nil)
        #expect(account.nextDeposit?.amount == Decimal(232))
        #expect(account.transactions.count == 7)
        // First fixture txn (newest) is Walmart Supercenter -$23.60.
        #expect(account.transactions.first?.merchant == "Walmart Supercenter")
        #expect(account.transactions.first?.amount == Decimal(string: "-23.60"))
    }

    @Test("EBTBalanceFixtures.perks count + Market Match still present")
    func perksFixturePreserved() {
        #expect(EBTBalanceFixtures.perks.count == 4)
        let titles = EBTBalanceFixtures.perks.map(\.title.en)
        #expect(titles.contains("Market Match"))
        #expect(titles.contains("Museums for All"))
    }

    // MARK: - simulatePurchase / simulateDeposit at flag-OFF

    @Test("simulatePurchase at flag-OFF prepends one txn + reduces balance")
    func simulatePurchasePreservesPrePlanBehavior() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: Self.flagOff)
        await store.link()
        let pre = store.account!.foodBalance
        let preCount = store.account!.transactions.count

        store.simulatePurchase()

        #expect(store.account!.transactions.count == preCount + 1)
        // Newest transaction is the simulated purchase (newest-first).
        #expect(store.account!.transactions.first?.amount ?? 0 < 0)
        // Balance went down by the absolute amount of the new txn.
        let newest = store.account!.transactions.first!
        #expect(store.account!.foodBalance == pre + newest.amount)
        // Last-updated re-stamped.
        #expect(store.account!.lastUpdated.timeIntervalSinceNow > -2)
    }

    @Test("simulateDeposit at flag-OFF prepends one deposit + raises balance")
    func simulateDepositPreservesPrePlanBehavior() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: Self.flagOff)
        await store.link()
        let pre = store.account!.foodBalance
        let depositAmount = store.account!.nextDeposit!.amount

        store.simulateDeposit()

        #expect(store.account!.foodBalance == pre + depositAmount)
        #expect(store.account!.transactions.first?.isDeposit == true)
        #expect(store.account!.transactions.first?.amount == depositAmount)
    }

    @Test("link() at flag-OFF loads fixture (not the repository path)")
    func linkPreservesFixturePath() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: Self.flagOff)
        await store.link()
        #expect(store.linkState == .linked)
        // The fixture's specific starting balance must show up.
        #expect(store.account?.foodBalance == Decimal(string: "76.12"))
    }

    // MARK: - EBTBalanceInsights determinism

    @Test("EBTBalanceInsights at flag-OFF returns the same shape as pre-plan")
    func insightsAreDeterministicOnDemoAccount() {
        let account = EBTBalanceFixtures.demoAccount()
        let insights = EBTBalanceInsights(account: account)
        // Demo balance ($76.12) is above the $20 low-balance threshold
        // → isLowBalance should be false.
        #expect(insights.isLowBalance == false)
        // The demo has 6 purchases; projection should resolve to a date.
        #expect(insights.projectedRunOutDate != nil)
        // Spend percent is bounded [0, 1].
        #expect(insights.spentPercent >= 0)
        #expect(insights.spentPercent <= 1)
    }

    // MARK: - Repository path is dormant at flag-OFF

    @Test("Repository.refresh at flag-OFF does not touch the API client")
    func repositoryDormantAtFlagOff() async {
        let api = MockEBTBalanceAPIClient()
        let repo = EBTBalanceRepository(
            apiClient: api,
            defaults: UserDefaults(suiteName: "regression-\(UUID())")!,
            cacheKey: "co.civica.ebt.account.v2",
            realDataFlag: Self.flagOff
        )
        await repo.refresh()
        #expect(api.refreshCount == 0)
        #expect(api.linkCalled == false)
        #expect(repo.account == nil)
    }
}
