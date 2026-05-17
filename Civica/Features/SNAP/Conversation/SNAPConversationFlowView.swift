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
        SNAPConversationView(viewModel: viewModel)
            .navigationTitle(SNAPConversationViewStrings.screenerTitle.value(in: resolvedLanguage))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if let onClose = onClose {
                    ToolbarItem(placement: .topBarLeading) {
                        Button(SNAPConversationViewStrings.close.value(in: resolvedLanguage)) { onClose() }
                    }
                }
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
    /// Note: HTTPSNAPNetworkClient sends requests to /me/* endpoints on
    /// the Hono gateway. Supply an authTokenProvider when Supabase user
    /// sessions are available; the gateway will return 401 without a
    /// valid JWT. TODO: wire auth when Supabase sign-in is integrated.
    static func defaultClient() -> SNAPNetworkClient {
        let env = ProcessInfo.processInfo.environment
        let urlString = env["SNAP_GATEWAY_URL"]
            ?? (Bundle.main.object(forInfoDictionaryKey: "SNAPConversationBackendURL") as? String)
        if let urlString, let url = URL(string: urlString) {
            return HTTPSNAPNetworkClient(baseURL: url)
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
