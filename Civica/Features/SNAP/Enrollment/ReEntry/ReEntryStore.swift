import Combine
import Foundation
import OSLog

// UI-state owner for the re-entry assist surface (G2-3, Unrath retention
// pillar). Per the EBT/EBTBalanceStore pattern: data is owned by
// ReEntryRepository; this store narrows to the view-facing state machine
// and orchestrates user-driven actions.
//
// State machine:
//   .idle             → before any fetch
//   .loading          → fetchSuggestion in flight
//   .noCandidate      → server says no recent close; card hidden
//   .candidate(...)   → ready to render the card
//   .enrolling        → user confirmed; reEnroll request in flight
//   .completed(...)   → new packet created; card hand-off to packet flow
//   .error(...)       → fetch or enroll failed; show retry
//
// Threading: @MainActor — all state mutations and SwiftUI binding hops
// stay on the main thread.

@MainActor
final class ReEntryStore: ObservableObject {
    enum State: Equatable {
        case idle
        case loading
        case noCandidate
        case candidate(suggestion: ReEntrySuggestionResponse)
        case enrolling
        case completed(packet: ReEnrollResponse.Packet, idempotent: Bool)
        case error(message: String)
    }

    @Published private(set) var state: State = .idle

    private let repository: ReEntryRepository
    private let analytics: any ReEntryAnalyticsSink
    private static let logger = Logger(subsystem: "Civica", category: "ReEntryStore")

    init(
        repository: ReEntryRepository,
        analytics: any ReEntryAnalyticsSink = DefaultReEntryAnalyticsSink()
    ) {
        self.repository = repository
        self.analytics = analytics
    }

    // MARK: - Actions

    /// Fetch the current suggestion. Called by the host view on appear.
    /// Safe to call multiple times — the store de-dupes by checking
    /// in-flight state.
    func loadSuggestion() async {
        guard state.canStartLoad else { return }
        state = .loading
        do {
            let response = try await repository.fetchSuggestion()
            if response.candidate, response.prior_packet != nil {
                state = .candidate(suggestion: response)
                analytics.trackImpression()
            } else {
                state = .noCandidate
            }
        } catch {
            Self.logger.error("Re-entry suggestion fetch failed: \(String(describing: error))")
            state = .error(message: String(describing: error))
            analytics.trackError(stage: .load)
        }
    }

    /// Confirmed re-enrollment from the surfaced prior packet. No-op
    /// if state isn't .candidate — the UI should only invoke this
    /// from the candidate state's primary CTA.
    func confirmReEnroll() async {
        guard case let .candidate(suggestion) = state,
              let prior = suggestion.prior_packet else {
            Self.logger.error("confirmReEnroll called outside .candidate state — UI bug")
            return
        }
        state = .enrolling
        do {
            let response = try await repository.reEnroll(fromPacketId: prior.packet_id)
            state = .completed(packet: response.packet, idempotent: response.idempotent)
            analytics.trackConfirmed(idempotent: response.idempotent)
        } catch {
            Self.logger.error("Re-enrollment failed: \(String(describing: error))")
            state = .error(message: String(describing: error))
            analytics.trackError(stage: .enroll)
        }
    }

    /// User tapped "Not now" — collapses to noCandidate so the card
    /// hides for this session. Re-appears on next `loadSuggestion`
    /// (e.g., next cold start).
    func dismiss() {
        state = .noCandidate
        analytics.trackDismissed()
    }

    /// Retry from .error back to .idle so the next loadSuggestion
    /// can attempt fresh.
    func reset() {
        state = .idle
    }
}

private extension ReEntryStore.State {
    /// True only when we should kick off a new fetch. Prevents double-
    /// loading while the user is mid-flow.
    var canStartLoad: Bool {
        switch self {
        case .idle, .error:
            return true
        case .loading, .noCandidate, .candidate, .enrolling, .completed:
            return false
        }
    }
}
