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
//
// Phase 2 / Lane G wires in EBTAnomalyStore (anti-skimming alerts).
// The anomaly store subscribes to the repository. At flag-OFF the
// repository is backed by a mock client and serves no transactions,
// so activeAlerts will always be empty — the banner is invisible.

// MARK: - AccessibilityElement = parent
struct EBTBalanceRootView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    // The store hierarchy is constructed lazily so production wiring
    // (flag-ON with a real API client) can be injected by the parent.
    // For previews + flag-OFF, the defaults produce a fixture-backed
    // stack with no network calls.
    @StateObject private var store: EBTBalanceStore
    @StateObject private var anomalyStore: EBTAnomalyStore

    @StateObject private var offersStore: EBTOffersStore

    /// Failable initializer used by previews + the production app entry
    /// point. Pass nil for all to get the fixture-only stack.
    init(
        store: EBTBalanceStore? = nil,
        anomalyStore: EBTAnomalyStore? = nil,
        offersAPIClient: (any EBTOffersAPIClient)? = nil
    ) {
        let resolvedStore = store ?? EBTBalanceStore()
        let resolvedAnomalyStore: EBTAnomalyStore

        if let provided = anomalyStore {
            resolvedAnomalyStore = provided
        } else {
            // Fixture-only stack: mock client + in-memory defaults.
            // No network calls; activeAlerts always empty at flag-OFF.
            let mockClient = MockEBTBalanceAPIClient()
            let repo = EBTBalanceRepository(
                apiClient: mockClient,
                defaults: UserDefaults(suiteName: "co.civica.ebt.root.preview") ?? .standard
            )
            resolvedAnomalyStore = EBTAnomalyStore(repository: repo)
        }

        let offersRepo = EBTOffersRepository(
            apiClient: offersAPIClient ?? MockEBTOffersAPIClient(),
            defaults: UserDefaults(suiteName: "co.civica.ebt.offers.root") ?? .standard
        )

        _store = StateObject(wrappedValue: resolvedStore)
        _anomalyStore = StateObject(wrappedValue: resolvedAnomalyStore)
        _offersStore = StateObject(wrappedValue: EBTOffersStore(repository: offersRepo))
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        Group {
            if store.account != nil {
                EBTBalanceDashboardView(
                    store: store,
                    anomalyStore: anomalyStore,
                    offersStore: offersStore,
                    language: language,
                    stateCode: "CA"
                )
            } else {
                EBTLinkCardView(store: store, language: language)
            }
        }
        .navigationTitle(EBTBalanceStrings.screenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .civicaAnimation(.easeInOut(duration: 0.28), value: store.linkState)
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
