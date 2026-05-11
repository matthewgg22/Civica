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

    var body: some View {
        SNAPConversationView(viewModel: viewModel)
            .navigationTitle("SNAP Eligibility Screener")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if let onClose = onClose {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Close") { onClose() }
                    }
                }
            }
    }

    /// Default network client. Mock when no backend URL is configured;
    /// real HTTP client when SNAPConversationBackendURL is set in
    /// Info.plist or as a launch argument.
    static func defaultClient() -> SNAPNetworkClient {
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "SNAPConversationBackendURL") as? String,
           let url = URL(string: urlString) {
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
