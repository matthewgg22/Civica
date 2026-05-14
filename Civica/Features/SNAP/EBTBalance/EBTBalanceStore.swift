import Foundation

// Link-state owner for the Check EBT Balance feature.
//
// Demo scope: there is no real EBT integration. "Linking" is a
// simulated step — the store flips to .linked after a short delay and
// serves the EBTBalanceFixtures demo account. The linked flag is
// persisted so the dashboard survives relaunch; "Unlink" resets it so
// the first-run flow can be demoed again.

@MainActor
final class EBTBalanceStore: ObservableObject {
    enum LinkState: Equatable {
        case unlinked
        case linking
        case linked
    }

    private let linkedKey = "co.civica.ebt.isLinked"

    @Published private(set) var linkState: LinkState

    init() {
        let linked = UserDefaults.standard.bool(forKey: linkedKey)
        linkState = linked ? .linked : .unlinked
    }

    /// The linked account, or nil when no card is connected. Demo-only:
    /// always the same seeded fixture once linked.
    var account: EBTAccount? {
        linkState == .linked ? EBTBalanceFixtures.demoAccount : nil
    }

    /// Simulate connecting an EBT card. Real linking would hand the
    /// card number to a state-EBT integration; here it just waits,
    /// then flips to .linked.
    func link() async {
        guard linkState == .unlinked else { return }
        linkState = .linking
        try? await Task.sleep(nanoseconds: 1_400_000_000)
        UserDefaults.standard.set(true, forKey: linkedKey)
        linkState = .linked
    }

    /// Reset to the unlinked state so the connect flow can be demoed
    /// again.
    func unlink() {
        UserDefaults.standard.set(false, forKey: linkedKey)
        linkState = .unlinked
    }
}
