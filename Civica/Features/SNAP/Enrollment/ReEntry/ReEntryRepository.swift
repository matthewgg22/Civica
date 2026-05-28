import Foundation
import OSLog

// Owns the source of truth for re-entry data. Per the EBT pattern:
// data fetching + cache lives here; the ReEntryStore narrows to UI state.
//
// Threading: @MainActor so the suggestion result feeds SwiftUI directly.
// Network I/O happens inside async methods that suspend off the main
// thread via URLSession's awaiters.
//
// Feature flag: when ReEntryFeatureFlag.isEnabled is false, the
// repository short-circuits to a "no candidate" result without calling
// the API. This preserves pre-feature behavior identically.

@MainActor
final class ReEntryRepository {
    private let apiClient: any ReEntryAPIClient
    private let isFlagEnabled: () -> Bool

    private static let logger = Logger(subsystem: "Civica", category: "ReEntryRepository")

    init(
        apiClient: any ReEntryAPIClient,
        isFlagEnabled: @escaping () -> Bool = { ReEntryFeatureFlag.isEnabled }
    ) {
        self.apiClient = apiClient
        self.isFlagEnabled = isFlagEnabled
    }

    /// Fetch the current re-entry suggestion. At flag-OFF returns a
    /// not-a-candidate result without touching the network — this
    /// preserves pre-feature behavior with zero API surface exposure.
    func fetchSuggestion() async throws -> ReEntrySuggestionResponse {
        guard isFlagEnabled() else {
            return ReEntrySuggestionResponse(
                candidate: false,
                days_since_close: nil,
                prior_packet: nil
            )
        }
        return try await apiClient.fetchSuggestion()
    }

    /// Trigger the re-enrollment from a prior packet. Returns the new
    /// (or pre-existing idempotent) Draft packet. Flag-OFF is treated as
    /// a programmer error — the UI should never reach this method when
    /// the flag is off because the card won't render.
    func reEnroll(fromPacketId packetId: String) async throws -> ReEnrollResponse {
        guard isFlagEnabled() else {
            // Defensive: don't silently swallow. Log + throw so we catch
            // any code path that bypasses the flag check at the UI layer.
            Self.logger.error("reEnroll called while ReEntryFeatureFlag is OFF — UI bypass bug")
            throw ReEntryAPIError.transport("Re-entry feature flag is disabled")
        }
        return try await apiClient.reEnroll(fromPacketId: packetId)
    }
}
