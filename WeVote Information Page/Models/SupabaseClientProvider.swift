import SwiftUI
import OSLog
import Supabase
typealias AppSupabaseClient = SupabaseClient
typealias SupabaseSession = Session
typealias SupabaseUser = User

final class SupabaseClientProvider {
    static let shared = SupabaseClientProvider()

    let client: AppSupabaseClient
    private static let logger = Logger(subsystem: "VoteNow", category: "SupabaseClientProvider")

    private init(config: SupabaseConfig = .current) {
        let options = SupabaseClientOptions(
            auth: .init(emitLocalSessionAsInitialSession: true)
        )
        self.client = SupabaseClient(
            supabaseURL: config.url,
            supabaseKey: config.anonKey,
            options: options
        )
    }
}

private struct SupabaseClientEnvironmentKey: EnvironmentKey {
    static var defaultValue: AppSupabaseClient = SupabaseClientProvider.shared.client
}

extension EnvironmentValues {
    var supabaseClient: AppSupabaseClient {
        get { self[SupabaseClientEnvironmentKey.self] }
        set { self[SupabaseClientEnvironmentKey.self] = newValue }
    }
}

extension View {
    func supabaseClient(_ client: AppSupabaseClient) -> some View {
        environment(\.supabaseClient, client)
    }
}
