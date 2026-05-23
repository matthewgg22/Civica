import Combine
import Foundation
import OSLog

// Owns the source of truth for EBT account data. Per plan Q1/D8:
// data fetching + cache + optimistic state lives here; the
// EBTBalanceStore narrows to UI state and subscribes to `$account`.
//
// Cache: UserDefaults under `co.civica.ebt.account.v2` (the v2 suffix
// reserves the v1 namespace for any pre-Plan cached state and lets
// us bump if the snapshot shape changes). JSON-encoded.
//
// Threading: @MainActor so the @Published binding feeds SwiftUI
// directly. Network I/O happens inside async methods that suspend
// off the main thread via URLSession's awaiters.
//
// Feature flag: when `FeatureFlags.ebtRealData == false`, the
// repository serves EBTBalanceFixtures.demoAccount() instead of
// hitting the API client. This preserves the pre-plan experience per
// the IRON RULE.

@MainActor
final class EBTBalanceRepository: ObservableObject {
    @Published private(set) var account: EBTAccount?
    @Published private(set) var lastError: EBTBalanceAPIError?
    @Published private(set) var isRefreshing: Bool = false

    private let apiClient: any EBTBalanceAPIClient
    private let defaults: UserDefaults
    private let cacheKey: String
    private let realDataFlag: () -> Bool
    private static let logger = Logger(subsystem: "Civica", category: "EBTBalanceRepository")

    /// Designated initializer. Tests inject a mock api client +
    /// in-memory UserDefaults; production uses the HTTP client + the
    /// shared defaults.
    init(
        apiClient: any EBTBalanceAPIClient,
        defaults: UserDefaults = .standard,
        cacheKey: String = "co.civica.ebt.account.v2",
        realDataFlag: @escaping () -> Bool = { FeatureFlags.ebtRealData }
    ) {
        self.apiClient = apiClient
        self.defaults = defaults
        self.cacheKey = cacheKey
        self.realDataFlag = realDataFlag
        self.account = loadCache()
    }

    // MARK: - Public surface

    /// Re-fetch balance + recent transactions and persist to cache.
    /// At flag-OFF, no-op (the fixture path owns its own refresh
    /// via EBTBalanceStore).
    func refresh() async {
        guard realDataFlag() else {
            // Flag-OFF path: caller (EBTBalanceStore) drives the
            // fixture-based refresh directly. No-op here.
            return
        }
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        lastError = nil

        do {
            let balanceResp = try await apiClient.fetchBalance()
            let txnsResp = try await apiClient.fetchTransactions(cursor: nil)
            let merged = merge(
                current: account,
                balance: balanceResp,
                transactions: txnsResp
            )
            account = merged
            persistCache(merged)
        } catch let e as EBTBalanceAPIError {
            Self.logger.error("Repository refresh failed: \(e.localizedDescription, privacy: .public)")
            lastError = e
        } catch {
            Self.logger.error("Repository refresh unknown error: \(error.localizedDescription, privacy: .public)")
            lastError = .unexpectedStatus(0, body: error.localizedDescription)
        }
    }

    /// Link a card via captured cookie + (optional) remember-me cookie.
    /// On success, immediately follows with a refresh().
    func link(cookie: String, rememberCookie: String?, expiresAt: Date) async {
        guard realDataFlag() else { return }
        lastError = nil
        do {
            _ = try await apiClient.linkCard(
                cookie: cookie,
                rememberCookie: rememberCookie,
                expiresAt: expiresAt
            )
            await refresh()
        } catch let e as EBTBalanceAPIError {
            lastError = e
        } catch {
            lastError = .unexpectedStatus(0, body: error.localizedDescription)
        }
    }

    /// Clear cached account + in-memory state. The API-side unlink
    /// (forgetting the cookie on the gateway) is a separate call the
    /// store invokes; this just wipes local state.
    func unlink() {
        account = nil
        defaults.removeObject(forKey: cacheKey)
    }

    /// Apply an optimistic transaction (e.g. a deposit-landed push
    /// arrived; render it before the next scrape confirms). Prepends
    /// to the txn list and adjusts the cached balance. When the next
    /// refresh() pulls the server snapshot, that snapshot wins — any
    /// optimistic txn that wasn't yet visible server-side is
    /// re-emitted by the merge below.
    func applyOptimistic(transaction: EBTTransaction) {
        guard var current = account else { return }
        current.transactions.insert(transaction, at: 0)
        current.foodBalance = max(0, current.foodBalance + transaction.amount)
        current.lastUpdated = Date()
        account = current
        persistCache(current)
    }

    /// Replace the entire account snapshot (used by the fixture-path
    /// store when the flag is OFF, so the store can keep operating on
    /// `account` through the same publisher).
    func overrideAccount(_ account: EBTAccount?) {
        self.account = account
        if let account {
            persistCache(account)
        } else {
            defaults.removeObject(forKey: cacheKey)
        }
    }

    // MARK: - Merge

    /// Merge server snapshots into an existing account, preserving
    /// optimistic local transactions that haven't been confirmed yet
    /// (matched by id).
    private func merge(
        current: EBTAccount?,
        balance: EBTBalanceResponse,
        transactions: EBTTransactionsResponse
    ) -> EBTAccount {
        let serverTxns = transactions.transactions.map { dto -> EBTTransaction in
            EBTTransaction(
                id: UUID(uuidString: dto.id) ?? UUID(),
                merchant: dto.merchant,
                amount: Decimal(dto.amountCents) / 100,
                date: dto.postedAt,
                category: parseCategory(dto.category)
            )
        }

        // Preserve optimistic locals whose ids aren't yet in the
        // server snapshot. Server is otherwise authoritative.
        let serverIds = Set(serverTxns.map(\.id))
        let preservedLocals: [EBTTransaction]
        if let current {
            preservedLocals = current.transactions.filter { !serverIds.contains($0.id) }
        } else {
            preservedLocals = []
        }
        let merged = (preservedLocals + serverTxns).sorted { $0.date > $1.date }

        let nextDeposit: EBTDeposit?
        if let amountCents = balance.nextDepositAmountCents,
           let on = balance.nextDepositOn {
            nextDeposit = EBTDeposit(amount: Decimal(amountCents) / 100, expectedDate: on)
        } else {
            nextDeposit = current?.nextDeposit
        }

        let cashBalance: Decimal? = balance.cashBalanceCents.map { Decimal($0) / 100 }
            ?? current?.cashBalance

        return EBTAccount(
            foodBalance: Decimal(balance.foodBalanceCents) / 100,
            cashBalance: cashBalance,
            lastUpdated: balance.balanceAt,
            nextDeposit: nextDeposit,
            depositDayOfMonth: balance.depositDayOfMonth
                ?? current?.depositDayOfMonth
                ?? Calendar.current.component(.day, from: Date()),
            transactions: merged
        )
    }

    private func parseCategory(_ raw: String) -> EBTTransactionCategory {
        EBTTransactionCategory(rawValue: raw) ?? .other
    }

    // MARK: - Cache

    /// Snapshot persisted to UserDefaults. A small DTO keeps the
    /// public model types Codable-free; if the snapshot shape
    /// changes, bump the cacheKey suffix.
    private struct CachedAccount: Codable {
        let foodBalanceCents: Int
        let cashBalanceCents: Int?
        let lastUpdated: Date
        let nextDepositAmountCents: Int?
        let nextDepositOn: Date?
        let depositDayOfMonth: Int
        let transactions: [CachedTransaction]
    }

    private struct CachedTransaction: Codable {
        let id: String
        let merchant: String
        let amountCents: Int
        let date: Date
        let category: String
    }

    private func loadCache() -> EBTAccount? {
        guard let data = defaults.data(forKey: cacheKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let cached = try? decoder.decode(CachedAccount.self, from: data) else {
            Self.logger.warning("EBT cache decode failed; ignoring")
            return nil
        }
        let nextDeposit: EBTDeposit?
        if let amountCents = cached.nextDepositAmountCents,
           let on = cached.nextDepositOn {
            nextDeposit = EBTDeposit(amount: Decimal(amountCents) / 100, expectedDate: on)
        } else {
            nextDeposit = nil
        }
        return EBTAccount(
            foodBalance: Decimal(cached.foodBalanceCents) / 100,
            cashBalance: cached.cashBalanceCents.map { Decimal($0) / 100 },
            lastUpdated: cached.lastUpdated,
            nextDeposit: nextDeposit,
            depositDayOfMonth: cached.depositDayOfMonth,
            transactions: cached.transactions.map { t in
                EBTTransaction(
                    id: UUID(uuidString: t.id) ?? UUID(),
                    merchant: t.merchant,
                    amount: Decimal(t.amountCents) / 100,
                    date: t.date,
                    category: EBTTransactionCategory(rawValue: t.category) ?? .other
                )
            }
        )
    }

    private func persistCache(_ account: EBTAccount) {
        let cached = CachedAccount(
            foodBalanceCents: NSDecimalNumber(decimal: account.foodBalance * 100).intValue,
            cashBalanceCents: account.cashBalance.map { NSDecimalNumber(decimal: $0 * 100).intValue },
            lastUpdated: account.lastUpdated,
            nextDepositAmountCents: account.nextDeposit.map {
                NSDecimalNumber(decimal: $0.amount * 100).intValue
            },
            nextDepositOn: account.nextDeposit?.expectedDate,
            depositDayOfMonth: account.depositDayOfMonth,
            transactions: account.transactions.map { t in
                CachedTransaction(
                    id: t.id.uuidString,
                    merchant: t.merchant,
                    amountCents: NSDecimalNumber(decimal: t.amount * 100).intValue,
                    date: t.date,
                    category: t.category.rawValue
                )
            }
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(cached) else { return }
        defaults.set(data, forKey: cacheKey)
    }
}
