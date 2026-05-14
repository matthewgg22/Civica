import Foundation

// Link-state + account owner for the Check EBT Balance feature.
//
// Demo scope: there is no real EBT integration. "Linking" and
// "refreshing" are simulated — the store waits briefly, then serves
// (or re-serves) the EBTBalanceFixtures demo account. The linked flag
// is persisted so the dashboard survives relaunch; "Unlink" resets it
// so the first-run flow can be demoed again.

@MainActor
final class EBTBalanceStore: ObservableObject {
    enum LinkState: Equatable {
        case unlinked
        case linking
        case linked
    }

    private let linkedKey = "co.civica.ebt.isLinked"
    private let cardLockedKey = "co.civica.ebt.cardLocked"
    private let blockOutOfStateKey = "co.civica.ebt.blockOutOfState"
    private let blockOnlineKey = "co.civica.ebt.blockOnline"

    @Published private(set) var linkState: LinkState
    /// The linked account, or nil when no card is connected. Held as
    /// state (not computed) so refresh() can re-stamp it and the view
    /// re-renders with the new "last updated" time.
    @Published private(set) var account: EBTAccount?

    /// Card-lock security state. When locked, a real EBT card cannot
    /// be used until unlocked — here it just drives the locked banner
    /// + status copy. All three flags are persisted.
    @Published private(set) var isCardLocked: Bool
    @Published private(set) var blockOutOfState: Bool
    @Published private(set) var blockOnline: Bool

    init() {
        let linked = UserDefaults.standard.bool(forKey: linkedKey)
        linkState = linked ? .linked : .unlinked
        account = linked ? EBTBalanceFixtures.demoAccount() : nil
        isCardLocked = UserDefaults.standard.bool(forKey: cardLockedKey)
        blockOutOfState = UserDefaults.standard.bool(forKey: blockOutOfStateKey)
        blockOnline = UserDefaults.standard.bool(forKey: blockOnlineKey)
    }

    /// Simulate connecting an EBT card. Real linking would hand the
    /// card number to a state-EBT integration; here it just waits,
    /// then flips to .linked and loads the demo account.
    func link() async {
        guard linkState == .unlinked else { return }
        linkState = .linking
        try? await Task.sleep(nanoseconds: 1_400_000_000)
        UserDefaults.standard.set(true, forKey: linkedKey)
        account = EBTBalanceFixtures.demoAccount()
        linkState = .linked
    }

    /// Pull-to-refresh. Real refresh would re-query the state EBT
    /// system; here it waits briefly and re-stamps "last updated" so
    /// the trust line reads fresh. Balance + transactions are left
    /// intact so any simulated activity survives a refresh.
    func refresh() async {
        guard linkState == .linked, var current = account else { return }
        try? await Task.sleep(nanoseconds: 700_000_000)
        current.lastUpdated = Date()
        account = current
    }

    // MARK: - Demo simulation

    /// Demo control: post a simulated purchase — prepend a new
    /// transaction, drop the balance, re-stamp "last updated". Stands
    /// in for real-world card activity so the dashboard can be shown
    /// reacting live.
    func simulatePurchase() {
        guard var current = account else { return }
        let purchase = EBTBalanceFixtures.randomDemoPurchase()
        current.transactions.insert(purchase, at: 0)
        current.foodBalance = max(0, current.foodBalance + purchase.amount)
        current.lastUpdated = Date()
        account = current
    }

    /// Demo control: post a simulated CalFresh deposit — prepend a
    /// deposit transaction and raise the balance.
    func simulateDeposit() {
        guard var current = account else { return }
        let amount = current.nextDeposit?.amount ?? 200
        let deposit = EBTBalanceFixtures.demoDepositTransaction(amount: amount)
        current.transactions.insert(deposit, at: 0)
        current.foodBalance += amount
        current.lastUpdated = Date()
        account = current
    }

    /// Reset to the unlinked state so the connect flow can be demoed
    /// again. Card-lock flags reset too — they belong to the linked
    /// card.
    func unlink() {
        UserDefaults.standard.set(false, forKey: linkedKey)
        account = nil
        linkState = .unlinked
        setCardLocked(false)
        setBlockOutOfState(false)
        setBlockOnline(false)
    }

    // MARK: - Card-lock security

    func setCardLocked(_ locked: Bool) {
        isCardLocked = locked
        UserDefaults.standard.set(locked, forKey: cardLockedKey)
    }

    func setBlockOutOfState(_ blocked: Bool) {
        blockOutOfState = blocked
        UserDefaults.standard.set(blocked, forKey: blockOutOfStateKey)
    }

    func setBlockOnline(_ blocked: Bool) {
        blockOnline = blocked
        UserDefaults.standard.set(blocked, forKey: blockOnlineKey)
    }
}
