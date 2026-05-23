import Combine
import Foundation

// UI-state owner for the Check EBT Balance feature. Per plan Q1/D8,
// data is owned by EBTBalanceRepository; this store narrows to:
//   - linkState (.unlinked / .linking / .linked)
//   - card-lock toggles + blockOutOfState + blockOnline
//   - republished account snapshot (so EBTBalanceDashboardView /
//     EBTLinkCardView keep their existing `store.account` binding)
//   - simulate-purchase + simulate-deposit demo controls, gated
//     behind FeatureFlags.ebtRealData (IRON RULE: flag-OFF
//     behavior is byte-identical to pre-plan)
//
// Wiring:
//   - At flag-OFF: the repository is bypassed; the store loads
//     EBTBalanceFixtures.demoAccount() directly (the pre-plan path).
//     simulatePurchase + simulateDeposit mutate the local account
//     and republish.
//   - At flag-ON: the repository owns `account`; the store
//     republishes via Combine, and link() / refresh() / unlink()
//     delegate to it. simulate* are unreachable from the UI when
//     the dashboard hides the demo menu at flag-ON.

@MainActor
final class EBTBalanceStore: ObservableObject {
    enum LinkState: Equatable {
        case unlinked
        case linking
        case linked
    }

    // MARK: UserDefaults keys
    private let linkedKey = "co.civica.ebt.isLinked"
    private let cardLockedKey = "co.civica.ebt.cardLocked"
    private let blockOutOfStateKey = "co.civica.ebt.blockOutOfState"
    private let blockOnlineKey = "co.civica.ebt.blockOnline"

    // MARK: Published surface
    @Published private(set) var linkState: LinkState
    @Published private(set) var account: EBTAccount?
    @Published private(set) var isCardLocked: Bool
    @Published private(set) var blockOutOfState: Bool
    @Published private(set) var blockOnline: Bool

    // MARK: Dependencies
    private let repository: EBTBalanceRepository?
    private let realDataFlag: () -> Bool
    private var cancellables: Set<AnyCancellable> = []

    // MARK: Init

    /// Production initializer — uses default UserDefaults and the
    /// shared FeatureFlags accessor. If a repository is supplied,
    /// real-data flow is enabled when the flag is on; if nil, the
    /// store stays on the fixture-only path regardless of flag (used
    /// for previews + the simplest tests).
    init(
        repository: EBTBalanceRepository? = nil,
        realDataFlag: @escaping () -> Bool = { FeatureFlags.ebtRealData }
    ) {
        self.repository = repository
        self.realDataFlag = realDataFlag

        let linked = UserDefaults.standard.bool(forKey: linkedKey)
        self.linkState = linked ? .linked : .unlinked
        self.isCardLocked = UserDefaults.standard.bool(forKey: cardLockedKey)
        self.blockOutOfState = UserDefaults.standard.bool(forKey: blockOutOfStateKey)
        self.blockOnline = UserDefaults.standard.bool(forKey: blockOnlineKey)

        // Initial account snapshot.
        if realDataFlag(), let repository {
            self.account = repository.account
            wireRepository(repository)
        } else {
            self.account = linked ? EBTBalanceFixtures.demoAccount() : nil
        }
    }

    private func wireRepository(_ repo: EBTBalanceRepository) {
        repo.$account
            .receive(on: RunLoop.main)
            .sink { [weak self] account in
                self?.account = account
            }
            .store(in: &cancellables)
    }

    // MARK: - Link / refresh / unlink

    /// Simulate connecting an EBT card (flag-OFF) OR mark linked
    /// after a real cookie capture (flag-ON, called from
    /// EBTLinkWebView via linkWithCookie). The existing EBTLinkCardView
    /// still drives this at flag-OFF.
    func link() async {
        guard linkState == .unlinked else { return }
        linkState = .linking
        if realDataFlag(), repository != nil {
            // Flag-ON: this entry point is no longer the right hook —
            // EBTLinkWebView calls linkWithCookie directly. Wait
            // briefly + flip to linked so any straggler caller
            // (e.g. EBTLinkCardView still mounted) doesn't dead-end.
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            UserDefaults.standard.set(true, forKey: linkedKey)
            linkState = .linked
            return
        }
        // Flag-OFF: pre-plan behavior preserved verbatim.
        try? await Task.sleep(nanoseconds: 1_400_000_000)
        UserDefaults.standard.set(true, forKey: linkedKey)
        account = EBTBalanceFixtures.demoAccount()
        linkState = .linked
    }

    /// Real-data link entry point invoked from EBTLinkWebView once
    /// the session cookie has been captured. No-op at flag-OFF.
    func linkWithCookie(_ cookie: String, rememberCookie: String?, expiresAt: Date) async {
        guard realDataFlag(), let repository else { return }
        linkState = .linking
        await repository.link(cookie: cookie, rememberCookie: rememberCookie, expiresAt: expiresAt)
        UserDefaults.standard.set(true, forKey: linkedKey)
        linkState = .linked
    }

    /// Pull-to-refresh. Flag-OFF: re-stamps "last updated" on the
    /// fixture in place (pre-plan behavior). Flag-ON: delegates to
    /// the repository.
    func refresh() async {
        if realDataFlag(), let repository {
            await repository.refresh()
            return
        }
        // Flag-OFF: pre-plan behavior preserved verbatim.
        guard linkState == .linked, var current = account else { return }
        try? await Task.sleep(nanoseconds: 700_000_000)
        current.lastUpdated = Date()
        account = current
    }

    /// Reset to unlinked. Clears card-lock flags too.
    func unlink() {
        UserDefaults.standard.set(false, forKey: linkedKey)
        if realDataFlag(), let repository {
            repository.unlink()
        }
        account = nil
        linkState = .unlinked
        setCardLocked(false)
        setBlockOutOfState(false)
        setBlockOnline(false)
    }

    // MARK: - Demo simulation
    //
    // IRON RULE: at flag-OFF these must behave IDENTICALLY to
    // pre-plan. At flag-ON they're hidden from the UI; if invoked
    // anyway (e.g. via a debug menu) they no-op to avoid corrupting
    // the repository-owned snapshot.

    /// Demo control: post a simulated purchase. Flag-OFF only.
    func simulatePurchase() {
        guard !realDataFlag() else { return }
        guard var current = account else { return }
        let purchase = EBTBalanceFixtures.randomDemoPurchase()
        current.transactions.insert(purchase, at: 0)
        current.foodBalance = max(0, current.foodBalance + purchase.amount)
        current.lastUpdated = Date()
        account = current
    }

    /// Demo control: post a simulated CalFresh deposit. Flag-OFF only.
    func simulateDeposit() {
        guard !realDataFlag() else { return }
        guard var current = account else { return }
        let amount = current.nextDeposit?.amount ?? 200
        let deposit = EBTBalanceFixtures.demoDepositTransaction(amount: amount)
        current.transactions.insert(deposit, at: 0)
        current.foodBalance += amount
        current.lastUpdated = Date()
        account = current
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
