import Combine
import Foundation
import OSLog

// Data source for the EBT offer-moment platform.
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T9 + E1).
//
// Per CLAUDE.md EBT-module convention (Store + Repository split):
//   - This Repository owns the network fetch, the in-memory cache, the
//     "Saved by Civica" tally accumulator, and the staleness contract.
//   - EBTOffersStore narrows to UI-shaped state and subscribes to the
//     published properties below.
//
// Cache: UserDefaults under `co.civica.ebt.offers.v1`. JSON-encoded.
// Hot path: every dashboard mount calls `refresh()`; the response is held
// in-memory + persisted so a subsequent cold launch can render the last
// known set with a `stale_as_of` footnote (see EBTOffersStrings).
//
// Threading: @MainActor so the @Published bindings feed SwiftUI directly.
// Network I/O happens inside async methods that suspend off the main thread
// via URLSession's awaiters.
//
// Feature flag: when `FeatureFlags.ebtRealData == false`, the repository
// serves an empty list (offers=[], freeResources=nil) — the perks card
// renders its existing static fixture path. Live data only flows when the
// flag is on and the catalog has rows.

@MainActor
final class EBTOffersRepository: ObservableObject {
    /// Latest server response. nil = never fetched yet (or flag-OFF).
    @Published private(set) var lastResponse: EBTOffersResponse?

    /// Lifetime savings tally in cents. Local mirror — server is truth
    /// source via `EBTRedemptionResponse.totalSavingsCents`. Persisted so
    /// the home tab can render a value pre-network on cold launch.
    @Published private(set) var totalSavingsCents: Int

    /// Date the lifetime tally was last updated client-side. Drives the
    /// "Since you joined in {month}" footer.
    @Published private(set) var tallyLastUpdated: Date?

    /// True while a /me/offers fetch is in flight.
    @Published private(set) var isRefreshing: Bool = false

    /// Last error surfaced from the server. Used only for ops debugging —
    /// the UI does NOT show error text; it falls back to last-cached.
    @Published private(set) var lastError: EBTOffersAPIError?

    /// When the cached `lastResponse` was retrieved. Drives the
    /// "Last updated {time ago}" footer when serving cached data.
    @Published private(set) var responseFetchedAt: Date?

    private let apiClient: any EBTOffersAPIClient
    private let defaults: UserDefaults
    private let cacheKey: String
    private let tallyCacheKey: String
    private let realDataFlag: () -> Bool
    private static let logger = Logger(subsystem: "Civica", category: "EBTOffersRepository")

    init(
        apiClient: any EBTOffersAPIClient,
        defaults: UserDefaults = .standard,
        cacheKey: String = "co.civica.ebt.offers.v1",
        tallyCacheKey: String = "co.civica.ebt.offers.savings_tally.v1",
        realDataFlag: @escaping () -> Bool = { FeatureFlags.ebtRealData }
    ) {
        self.apiClient = apiClient
        self.defaults = defaults
        self.cacheKey = cacheKey
        self.tallyCacheKey = tallyCacheKey
        self.realDataFlag = realDataFlag
        let cached = Self.loadCachedResponse(defaults: defaults, key: cacheKey)
        self.lastResponse = cached?.response
        self.responseFetchedAt = cached?.fetchedAt
        let tally = Self.loadCachedTally(defaults: defaults, key: tallyCacheKey)
        self.totalSavingsCents = tally.totalCents
        self.tallyLastUpdated = tally.updatedAt
    }

    // MARK: - Public surface

    /// Refresh the offers list. Flag-OFF = no-op (perks card falls back to
    /// existing static fixture path in EBTBalanceDashboardView).
    func refresh(
        packetCountyFips: String?,
        currentCountyFips: String?,
        stateCode: String,
        limit: Int = 6
    ) async {
        guard realDataFlag() else { return }
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        lastError = nil

        do {
            let response = try await apiClient.fetchOffers(
                packetCountyFips: packetCountyFips,
                currentCountyFips: currentCountyFips,
                stateCode: stateCode,
                limit: limit
            )
            lastResponse = response
            responseFetchedAt = Date()
            persistCache(response: response, fetchedAt: Date())
        } catch let err as EBTOffersAPIError {
            Self.logger.warning("refresh failed: \(err.localizedDescription)")
            lastError = err
            // Keep lastResponse — UI renders stale-as-of footer.
        } catch {
            Self.logger.error("refresh unexpected: \(String(describing: error))")
            lastError = .decode(String(describing: error))
        }
    }

    /// Emit impression / click. Fire-and-forget — failures are logged but
    /// never propagate to the UI. The OfferEventEmitter calls this from
    /// visibility-debounced .onAppear hooks (B-T13).
    func emitEvent(offerId: String, eventType: EBTOfferEvent.EventType, countyFips: String?) {
        guard realDataFlag() else { return }
        Task { [apiClient] in
            do {
                try await apiClient.emitEvent(EBTOfferEvent(
                    offerId: offerId,
                    eventType: eventType,
                    countyFips: countyFips,
                    occurredAt: Date()
                ))
            } catch {
                Self.logger.warning("emitEvent failed for \(eventType.rawValue) on \(offerId): \(String(describing: error))")
            }
        }
    }

    /// Record a self-attest redemption. Returns the server's authoritative
    /// total so the tally counter updates from the truth source, not from
    /// the local accumulator. Anti-inflation: server caps `savings_cents`
    /// at `offer.expected_savings_cents` and returns `capped: true`.
    @discardableResult
    func recordRedemption(offerId: String, savingsCents: Int) async throws -> EBTRedemptionResponse {
        let response = try await apiClient.recordRedemption(
            offerId: offerId,
            savingsCents: savingsCents
        )
        if let serverTotal = response.totalSavingsCents {
            totalSavingsCents = serverTotal
            tallyLastUpdated = Date()
            persistTally(totalCents: serverTotal, updatedAt: Date())
        }
        return response
    }

    // MARK: - Cache persistence

    private struct CachedResponseEnvelope: Codable {
        let response: EBTOffersResponse
        let fetchedAt: Date
    }

    private struct CachedTallyEnvelope: Codable {
        let totalCents: Int
        let updatedAt: Date
    }

    private func persistCache(response: EBTOffersResponse, fetchedAt: Date) {
        do {
            let env = CachedResponseEnvelope(response: response, fetchedAt: fetchedAt)
            let data = try JSONEncoder.civicaSnakeISO.encode(env)
            defaults.set(data, forKey: cacheKey)
        } catch {
            Self.logger.warning("persistCache failed: \(String(describing: error))")
        }
    }

    private func persistTally(totalCents: Int, updatedAt: Date) {
        do {
            let env = CachedTallyEnvelope(totalCents: totalCents, updatedAt: updatedAt)
            let data = try JSONEncoder.civicaSnakeISO.encode(env)
            defaults.set(data, forKey: tallyCacheKey)
        } catch {
            Self.logger.warning("persistTally failed: \(String(describing: error))")
        }
    }

    private static func loadCachedResponse(defaults: UserDefaults, key: String) -> (response: EBTOffersResponse, fetchedAt: Date)? {
        guard let data = defaults.data(forKey: key) else { return nil }
        do {
            let env = try JSONDecoder.civicaSnakeISO.decode(CachedResponseEnvelope.self, from: data)
            return (env.response, env.fetchedAt)
        } catch {
            return nil
        }
    }

    private static func loadCachedTally(defaults: UserDefaults, key: String) -> (totalCents: Int, updatedAt: Date?) {
        guard let data = defaults.data(forKey: key) else { return (0, nil) }
        do {
            let env = try JSONDecoder.civicaSnakeISO.decode(CachedTallyEnvelope.self, from: data)
            return (env.totalCents, env.updatedAt)
        } catch {
            return (0, nil)
        }
    }
}
