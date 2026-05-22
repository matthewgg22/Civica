import Foundation

// Submits the applicant's self-reported county decision.
//
// The enrollment-api endpoint does NOT exist yet — this client stubs
// the network call, persists locally, and leaves a TODO for the wire-
// up PR. Local persistence is the source of truth in the meantime so
// the prompt doesn't re-fire and the user's selection is preserved
// across launches even if they're offline.

/// The three outcomes that match the dashboard's CountyOutcomeButton
/// payload exactly (apps/dashboard/components/CountyOutcomeButton.tsx).
/// Wire-compatible so the eventual enrollment-api endpoint can share
/// the same enum on the server.
enum CountyOutcomeSelection: String, Codable, Sendable, CaseIterable {
    case approved
    case denied
    case pendingDecision = "pending_decision"
}

/// Persisted record of a single applicant self-report.
struct CountyOutcomeRecord: Codable, Equatable, Sendable {
    let packetId: String
    let selection: CountyOutcomeSelection
    let reportedAt: Date
}

@MainActor
final class CountyOutcomeClient {
    static let shared = CountyOutcomeClient()

    private let defaults: UserDefaults
    private let now: () -> Date
    private let networkSubmit: (CountyOutcomeRecord) async throws -> Void

    init(
        defaults: UserDefaults = .standard,
        now: @escaping () -> Date = Date.init,
        networkSubmit: @escaping (CountyOutcomeRecord) async throws -> Void = CountyOutcomeClient.defaultNetworkSubmit
    ) {
        self.defaults = defaults
        self.now = now
        self.networkSubmit = networkSubmit
    }

    // MARK: - Storage keys

    /// Per-packet UserDefaults key. Mirrors the recert module's
    /// per-document key shape (`co.civica.recert.{document}`).
    static func storageKey(forPacketId packetId: String) -> String {
        "co.civica.countyOutcome.\(packetId)"
    }

    // MARK: - Public surface

    /// Record the user's selection. Always writes locally first; then
    /// best-effort POSTs to the (future) enrollment-api endpoint.
    /// Returns the persisted record so callers can read it back without
    /// re-fetching from defaults.
    @discardableResult
    func submit(packetId: String, selection: CountyOutcomeSelection) async -> CountyOutcomeRecord {
        let record = CountyOutcomeRecord(
            packetId: packetId,
            selection: selection,
            reportedAt: now()
        )
        persist(record)

        // Cancel any pending +14d push so the user isn't nudged for
        // a decision they already gave us.
        CountyOutcomeNotificationService.shared.cancelAsk(packetId: packetId)

        do {
            try await networkSubmit(record)
        } catch {
            // Local persistence already happened — the eventual sync
            // pass (or the next foreground POST) will reconcile.
            // Failure here is non-fatal by design.
        }

        return record
    }

    /// Read the most recent record for a packet, if any. Drives the
    /// prompt-view's "show the after-submit confirmation if we already
    /// have an answer" branch.
    func storedRecord(forPacketId packetId: String) -> CountyOutcomeRecord? {
        let key = Self.storageKey(forPacketId: packetId)
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(CountyOutcomeRecord.self, from: data)
    }

    // MARK: - Internal

    private func persist(_ record: CountyOutcomeRecord) {
        let key = Self.storageKey(forPacketId: record.packetId)
        if let data = try? JSONEncoder().encode(record) {
            defaults.set(data, forKey: key)
        }
    }

    // TODO: wire to /me/packets/{id}/county-outcome on enrollment-api.
    // Until that endpoint ships (separate PR), this is a no-op so
    // local persistence is the source of truth. Match the dashboard's
    // PATCH payload shape: { packet_id, county_outcome }.
    static func defaultNetworkSubmit(_ record: CountyOutcomeRecord) async throws {
        // No-op stub.
    }
}
