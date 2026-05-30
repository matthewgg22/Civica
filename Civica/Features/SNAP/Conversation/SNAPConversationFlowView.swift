import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: container that wires up
// SNAPConversationView with a network client and view model. This is
// the destination view rendered when SNAPRouter.screenerRoute is
// .conversation.
//
// Network client selection:
//   - Debug builds default to MockSNAPNetworkClient so the screen
//     can be exercised end-to-end without a running backend.
//   - Override `SNAPConversationBackendOverride` (a Bundle Info.plist
//     key, or just edit `productionClient(for:)` here) to point at a
//     deployed FastAPI URL.

struct SNAPConversationFlowView: View {
    let stateCode: String
    let language: String
    let onClose: (() -> Void)?

    @StateObject private var viewModel: SNAPConversationViewModel

    // IS-5 + UD-3 (audit 2026-05-29): the shared soft-ineligibility
    // card surfaces three navigation destinations the conversation
    // didn't previously own. State-driven sheet / nav links live here.
    @State private var showsIntake: Bool = false
    @State private var showsFindHelp: Bool = false
    @State private var statePortalURL: URL?

    init(
        stateCode: String,
        language: String = "en",
        onClose: (() -> Void)? = nil,
        client: SNAPNetworkClient? = nil
    ) {
        self.stateCode = stateCode
        self.language = language
        self.onClose = onClose
        let resolvedClient = client ?? Self.defaultClient()
        _viewModel = StateObject(
            wrappedValue: SNAPConversationViewModel(
                client: resolvedClient,
                stateCode: stateCode,
                language: language
            )
        )
    }

    private var resolvedLanguage: CivicaLanguage {
        CivicaLanguage(rawValue: language) ?? .english
    }

    var body: some View {
        SNAPConversationView(
            viewModel: viewModel,
            onApplyAnyway: { showsIntake = true },
            onFindHelp: { showsFindHelp = true },
            onOpenStatePortal: {
                statePortalURL = CivicaExternalLinks.applyPortal(for: stateCode)
            }
        )
        .navigationTitle(SNAPConversationViewStrings.screenerTitle.value(in: resolvedLanguage))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let onClose = onClose {
                ToolbarItem(placement: .topBarLeading) {
                    Button(SNAPConversationViewStrings.close.value(in: resolvedLanguage)) { onClose() }
                        .accessibilityLabel(SNAPConversationViewStrings.close.value(in: resolvedLanguage))
                }
            }
        }
        .navigationDestination(isPresented: $showsIntake) {
            CivicaSNAPFlowView(language: resolvedLanguage)
        }
        .navigationDestination(isPresented: $showsFindHelp) {
            FindHelpRootView(
                initialFilter: FindHelpFilterState(
                    serviceType: .foodAssistance,
                    languageCode: nil
                )
            )
        }
        .sheet(item: $statePortalURL) { url in
            CivicaSafariSheet(url: url)
        }
    }

    /// Default network client. Mock when no backend URL is configured;
    /// real HTTP client when a gateway URL is available.
    ///
    /// URL resolution order:
    ///   1. SNAP_GATEWAY_URL process environment variable (set by the
    ///      "Civica Staging" Xcode scheme for gateway integration testing)
    ///   2. SNAPConversationBackendURL Info.plist key (manual override)
    ///   3. MockSNAPNetworkClient (default for all other builds)
    ///
    /// Pass `auth` to attach the applicant's Supabase JWT to every request.
    /// Without it, the gateway returns 401 on authenticated endpoints.
    static func defaultClient(auth: CivicaEnrollmentAuth? = nil) -> SNAPNetworkClient {
        let env = ProcessInfo.processInfo.environment
        let urlString = env["SNAP_GATEWAY_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "SNAPConversationBackendURL") as? String)
        if let urlString, let url = URL(string: urlString) {
            return HTTPSNAPNetworkClient(
                baseURL: url,
                authTokenProvider: { [weak auth] in await auth?.currentAccessToken() }
            )
        }
        return MockSNAPNetworkClient()
    }
}

#if DEBUG
struct SNAPConversationFlowView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPConversationFlowView(stateCode: "MA", language: "en", onClose: nil)
        }
    }
}
#endif
