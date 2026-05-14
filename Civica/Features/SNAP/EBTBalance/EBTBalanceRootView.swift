import CivicaDesignSystem
import SwiftUI

// Entry surface for the Check EBT Balance feature (Propel-style
// balance dashboard).
//
// Routes on EBTBalanceStore.linkState:
//   • .unlinked / .linking → EBTLinkCardView (connect-card flow)
//   • .linked              → EBTBalanceDashboardView (hero balance)
//
// Phase 1 built the hero card; Phase 2 added the connect-card flow and
// made this view the router between the two. Later phases layer in
// transaction history and card-lock security on the dashboard.
//
// Demo scope: California only. "Linking" is simulated — see
// EBTBalanceStore. Civica does not integrate with a real state EBT
// system, hence the always-visible demo disclosure on both surfaces.

struct EBTBalanceRootView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @StateObject private var store = EBTBalanceStore()

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        Group {
            if let account = store.account {
                EBTBalanceDashboardView(
                    account: account,
                    language: language,
                    onUnlink: { store.unlink() }
                )
            } else {
                EBTLinkCardView(store: store, language: language)
            }
        }
        .navigationTitle(EBTBalanceStrings.screenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .animation(.easeInOut(duration: 0.28), value: store.linkState)
    }
}

#if DEBUG
struct EBTBalanceRootView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            EBTBalanceRootView()
        }
    }
}
#endif
