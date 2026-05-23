import Combine
import Foundation
import Testing
@testable import Civica

// Covers T6 (store narrowing): the store still owns linkState, card-
// lock toggles, blockOutOfState/blockOnline, and republishes the
// repository's account. simulate* still works at flag-OFF; no-ops at
// flag-ON.
//
// These tests touch UserDefaults.standard for the linkedKey + lock
// keys — they read+write the live store on init/persistence. To
// avoid cross-test bleed we clear those keys before each test.

@MainActor
@Suite("EBTBalanceStore")
struct EBTBalanceStoreTests {
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

    // MARK: - Flag-OFF (pre-plan behavior preserved)

    @Test("Fresh store at flag-OFF starts unlinked with no account")
    func freshStateFlagOff() {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        #expect(store.linkState == .unlinked)
        #expect(store.account == nil)
    }

    @Test("link() at flag-OFF flips to .linked with the demo fixture")
    func linkAtFlagOff() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        await store.link()
        #expect(store.linkState == .linked)
        #expect(store.account != nil)
        // Demo CalFresh fixture is food-only, $76.12 starting balance.
        #expect(store.account?.cashBalance == nil)
    }

    @Test("simulatePurchase at flag-OFF prepends txn + reduces balance")
    func simulatePurchaseAtFlagOff() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        await store.link()
        let pre = store.account!.foodBalance
        let preCount = store.account!.transactions.count
        store.simulatePurchase()
        #expect(store.account!.transactions.count == preCount + 1)
        #expect(store.account!.foodBalance < pre)
    }

    @Test("simulateDeposit at flag-OFF prepends deposit + raises balance")
    func simulateDepositAtFlagOff() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        await store.link()
        let pre = store.account!.foodBalance
        store.simulateDeposit()
        #expect(store.account!.foodBalance > pre)
        #expect(store.account!.transactions.first?.isDeposit == true)
    }

    @Test("unlink at flag-OFF resets to unlinked + clears locks")
    func unlinkAtFlagOff() async {
        let store = EBTBalanceStore(repository: nil, realDataFlag: { false })
        await store.link()
        store.setCardLocked(true)
        store.unlink()
        #expect(store.linkState == .unlinked)
        #expect(store.account == nil)
        #expect(store.isCardLocked == false)
    }

    // MARK: - Flag-ON (IRON RULE: simulate* is a no-op)

    @Test("simulatePurchase no-ops at flag-ON")
    func simulatePurchaseFlagOnNoop() async {
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 5000, cashBalanceCents: nil,
            balanceAt: Date(), stale: false,
            nextDepositAmountCents: nil, nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        let repo = EBTBalanceRepository(
            apiClient: api,
            defaults: UserDefaults(suiteName: "store-flagon-\(UUID())")!,
            cacheKey: "co.civica.ebt.account.v2",
            realDataFlag: { true }
        )
        await repo.refresh()
        let store = EBTBalanceStore(repository: repo, realDataFlag: { true })
        let pre = store.account?.foodBalance
        store.simulatePurchase()
        #expect(store.account?.foodBalance == pre)
    }

    @Test("simulateDeposit no-ops at flag-ON")
    func simulateDepositFlagOnNoop() async {
        let api = MockEBTBalanceAPIClient()
        api.balanceResponse = EBTBalanceResponse(
            foodBalanceCents: 5000, cashBalanceCents: nil,
            balanceAt: Date(), stale: false,
            nextDepositAmountCents: nil, nextDepositOn: nil,
            depositDayOfMonth: 5
        )
        let repo = EBTBalanceRepository(
            apiClient: api,
            defaults: UserDefaults(suiteName: "store-flagon-2-\(UUID())")!,
            cacheKey: "co.civica.ebt.account.v2",
            realDataFlag: { true }
        )
        await repo.refresh()
        let store = EBTBalanceStore(repository: repo, realDataFlag: { true })
        let pre = store.account?.foodBalance
        store.simulateDeposit()
        #expect(store.account?.foodBalance == pre)
    }

    // MARK: - Card-lock persistence (unchanged from pre-plan)

    @Test("setCardLocked persists across instances")
    func cardLockPersists() async {
        let store1 = EBTBalanceStore(repository: nil, realDataFlag: { false })
        store1.setCardLocked(true)
        let store2 = EBTBalanceStore(repository: nil, realDataFlag: { false })
        #expect(store2.isCardLocked == true)
    }

    @Test("setBlockOutOfState + setBlockOnline persist across instances")
    func extraBlocksPersist() async {
        let store1 = EBTBalanceStore(repository: nil, realDataFlag: { false })
        store1.setBlockOutOfState(true)
        store1.setBlockOnline(true)
        let store2 = EBTBalanceStore(repository: nil, realDataFlag: { false })
        #expect(store2.blockOutOfState == true)
        #expect(store2.blockOnline == true)
    }
}
