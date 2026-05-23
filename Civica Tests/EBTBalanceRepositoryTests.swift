import Foundation
import Testing
@testable import Civica

// Covers T6 (repository half): cache hit/miss, refresh merges
// transactions, optimistic-then-server reconcile, link gates on flag,
// unlink clears cache.
//
// Suite-scoped UserDefaults: each test creates an in-memory suite so
// the production `UserDefaults.standard` is never touched. Plan
// memory feedback_swift_testing_concurrent → not needed here (no
// shared static state), but the API client stub used by the mock
// is per-instance.

@MainActor
@Suite("EBTBalanceRepository")
struct EBTBalanceRepositoryTests {
    /// Fresh in-memory UserDefaults per test via a unique suite name.
    private static func makeDefaults() -> UserDefaults {
        let suite = "test-ebt-repo-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        d.removePersistentDomain(forName: suite)
        return d
    }

    private static let testCacheKey = "co.civica.ebt.account.v2"

    private static func makeRepo(
        api: MockEBTBalanceAPIClient = MockEBTBalanceAPIClient(),
        defaults: UserDefaults? = nil,
        flagOn: Bool = true
    ) -> EBTBalanceRepository {
        EBTBalanceRepository(
            apiClient: api,
            defaults: defaults ?? makeDefaults(),
            cacheKey: testCacheKey,
            realDataFlag: { flagOn }
        )
    }

    // MARK: cache hit / miss

    @Test("Fresh repo loads no account (cache miss)")
    func cacheMissOnFreshDefaults() {
        let repo = Self.makeRepo()
        #expect(repo.account == nil)
    }

    @Test("Repo persists account through refresh + re-init loads cache (cache hit)")
    func cacheHitAcrossInstances() async {
        let defaults = Self.makeDefaults()
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 4444,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: nil,
            nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        let repo1 = Self.makeRepo(api: api, defaults: defaults)
        await repo1.refresh()
        #expect(repo1.account?.foodBalance == Decimal(44.44))

        // New instance against the same defaults → cache loads.
        let repo2 = Self.makeRepo(api: MockEBTBalanceAPIClient(), defaults: defaults)
        #expect(repo2.account?.foodBalance == Decimal(44.44))
    }

    // MARK: refresh + merge

    @Test("refresh merges server transactions into account")
    func refreshMergesTransactions() async {
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 5000,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: nil,
            nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        api.transactionsResponse = EBTTransactionsResponse(
            transactions: [
                EBTTransactionDTO(
                    id: UUID().uuidString,
                    postedAt: Date(),
                    amountCents: -1000,
                    merchant: "Walmart",
                    category: "groceries",
                    rawDescription: nil
                ),
                EBTTransactionDTO(
                    id: UUID().uuidString,
                    postedAt: Date().addingTimeInterval(-86400),
                    amountCents: -500,
                    merchant: "7-Eleven",
                    category: "other",
                    rawDescription: nil
                ),
            ],
            nextCursor: nil
        )
        let repo = Self.makeRepo(api: api)
        await repo.refresh()

        #expect(repo.account?.transactions.count == 2)
        #expect(repo.account?.foodBalance == Decimal(50))
        // Newest-first sort.
        #expect(repo.account?.transactions.first?.merchant == "Walmart")
    }

    // MARK: optimistic-then-server reconcile

    @Test("Optimistic transaction preserved when server snapshot omits it")
    func optimisticPreservedAcrossRefresh() async {
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 5000,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: nil,
            nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        api.transactionsResponse = EBTTransactionsResponse(transactions: [], nextCursor: nil)

        let repo = Self.makeRepo(api: api)
        await repo.refresh() // seeds account with empty txns

        let optimistic = EBTTransaction(
            id: UUID(),
            merchant: "Trader Joe's",
            amount: Decimal(-12),
            date: Date(),
            category: .groceries
        )
        repo.applyOptimistic(transaction: optimistic)
        #expect(repo.account?.transactions.first?.id == optimistic.id)

        // Refresh again — server still doesn't have it → preserved.
        await repo.refresh()
        #expect(repo.account?.transactions.contains { $0.id == optimistic.id } == true)
    }

    @Test("Optimistic txn replaced by server snapshot when ids match")
    func optimisticReplacedByServer() async {
        let txnId = UUID()
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 4000,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: nil,
            nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        api.transactionsResponse = EBTTransactionsResponse(transactions: [], nextCursor: nil)

        let repo = Self.makeRepo(api: api)
        await repo.refresh()
        repo.applyOptimistic(transaction: EBTTransaction(
            id: txnId, merchant: "Walmart (optimistic)",
            amount: Decimal(-10), date: Date(), category: .groceries
        ))

        // Server snapshot now contains the same id with authoritative
        // merchant string.
        api.transactionsResponse = EBTTransactionsResponse(
            transactions: [EBTTransactionDTO(
                id: txnId.uuidString,
                postedAt: Date(),
                amountCents: -1000,
                merchant: "Walmart Supercenter",
                category: "groceries",
                rawDescription: nil
            )],
            nextCursor: nil
        )
        await repo.refresh()

        let matched = repo.account?.transactions.first { $0.id == txnId }
        #expect(matched?.merchant == "Walmart Supercenter")
        // No duplicate emitted.
        let countWithId = repo.account?.transactions.filter { $0.id == txnId }.count
        #expect(countWithId == 1)
    }

    // MARK: link / unlink

    @Test("link forwards cookie to api client + triggers refresh")
    func linkInvokesApiAndRefreshes() async {
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 1234,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: nil,
            nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        let repo = Self.makeRepo(api: api)
        await repo.link(cookie: "JSESSIONID=abc", rememberCookie: nil, expiresAt: Date().addingTimeInterval(3600))

        #expect(api.linkCalled)
        #expect(repo.account?.foodBalance == Decimal(12.34))
    }

    @Test("unlink wipes cache + account")
    func unlinkClears() async {
        let defaults = Self.makeDefaults()
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 9999,
            cashBalanceCents: nil,
            balanceAt: Date(),
            stale: false,
            nextDepositAmountCents: nil,
            nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        let repo = Self.makeRepo(api: api, defaults: defaults)
        await repo.refresh()
        #expect(repo.account != nil)
        #expect(defaults.data(forKey: Self.testCacheKey) != nil)

        repo.unlink()
        #expect(repo.account == nil)
        #expect(defaults.data(forKey: Self.testCacheKey) == nil)
    }

    // MARK: feature-flag gating

    @Test("refresh no-ops when flag is OFF (IRON RULE)")
    func refreshIsNoOpAtFlagOff() async {
        let api = MockEBTBalanceAPIClient()
        let repo = Self.makeRepo(api: api, flagOn: false)
        await repo.refresh()
        #expect(repo.account == nil)
        #expect(repo.isRefreshing == false)
    }

    @Test("link no-ops when flag is OFF (IRON RULE)")
    func linkIsNoOpAtFlagOff() async {
        let api = MockEBTBalanceAPIClient()
        let repo = Self.makeRepo(api: api, flagOn: false)
        await repo.link(cookie: "x", rememberCookie: nil, expiresAt: Date())
        #expect(!api.linkCalled)
    }

    // MARK: error surfacing

    @Test("Scrape error from refresh surfaces on lastError")
    func scrapeErrorSurfacesOnLastError() async {
        let api = MockEBTBalanceAPIClient()
        api.shouldFailNextWithScrape = .sessionExpired
        let repo = Self.makeRepo(api: api)
        await repo.refresh()
        switch repo.lastError {
        case .scrape(let inner):
            #expect(inner == .sessionExpired)
        default:
            Issue.record("Expected .scrape(.sessionExpired), got \(String(describing: repo.lastError))")
        }
    }
}
