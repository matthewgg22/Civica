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

    @Published private(set) var linkState: LinkState
    /// The linked account, or nil when no card is connected. Held as
    /// state (not computed) so refresh() can re-stamp it and the view
    /// re-renders with the new "last updated" time.
    @Published private(set) var account: EBTAccount?

    init() {
        let linked = UserDefaults.standard.bool(forKey: linkedKey)
        linkState = linked ? .linked : .unlinked
        account = linked ? EBTBalanceFixtures.demoAccount() : nil
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
    /// system; here it waits briefly and re-stamps the demo account so
    /// the "last updated" line reads fresh.
    func refresh() async {
        guard linkState == .linked else { return }
        try? await Task.sleep(nanoseconds: 700_000_000)
        account = EBTBalanceFixtures.demoAccount(updatedSecondsAgo: 3)
    }

    /// Reset to the unlinked state so the connect flow can be demoed
    /// again.
    func unlink() {
        UserDefaults.standard.set(false, forKey: linkedKey)
        account = nil
        linkState = .unlinked
    }
}
