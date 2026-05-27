import Combine
import Foundation
import SwiftUI

// UI-state-shaped observable layer on top of EBTOffersRepository.
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T9).
//
// Per CLAUDE.md EBT-module convention (Store + Repository split):
//   - Repository = data fetch, cache, server-truth tally
//   - Store      = view-shaped state (DealsSection, distress branch,
//                  refresh affordance), language-localized resolved text
//
// The dashboard view reads `dealsSection` and branches on it:
//   - .offers([...])         → render live deal rows with pine accent
//   - .freeResources([...])  → render free-resources rows with brick accent
//                              (identical structure, silent-honor swap)
//   - .empty                 → render the calm "deals coming soon" copy
//                              alongside the existing static perks list
//   - .loading               → skeleton state
//
// The Store does NOT decide which to render — that's the view's job. It
// just classifies the latest repository response.

@MainActor
final class EBTOffersStore: ObservableObject {
    enum DealsSection: Equatable {
        case loading
        case offers([EBTOffer])
        case freeResources([EBTFreeResource])
        case empty
    }

    @Published private(set) var dealsSection: DealsSection = .loading

    // MARK: - Dashboard-compatible flat surface
    //
    // The EBTBalanceDashboardView's perksSection branches on these flat
    // properties (isLoading / isDistressed / offers / freeResources) instead
    // of the DealsSection enum. Both are derived from the same source state
    // and stay in sync via the classify() routine below.

    @Published private(set) var offers: [EBTOffer] = []
    @Published private(set) var freeResources: [EBTFreeResource] = []
    @Published private(set) var isDistressed: Bool = false
    @Published private(set) var isLoading: Bool = false

    /// Latest server-side total. Repository keeps this in sync after every
    /// redemption write; on cold launch we read it from UserDefaults.
    @Published private(set) var totalSavingsCents: Int = 0

    /// nil = user has never recorded a redemption.
    @Published private(set) var tallyLastUpdated: Date?

    /// Surfaces the "Last updated {time ago}" footer when serving cached
    /// data (network error path). nil = response is fresh from this session.
    @Published private(set) var staleAsOf: Date?

    let repository: EBTOffersRepository
    private var cancellables: Set<AnyCancellable> = []

    /// Once-per-session guard so .onAppear { fetchIfNeeded() } is idempotent.
    private var hasFetched = false

    /// Cached for the fetchIfNeeded() entry point that doesn't take args.
    /// Set via configure() or via the dashboard's init.
    var sessionContext: SessionContext = .ca()

    struct SessionContext {
        var packetCountyFips: String?
        var currentCountyFips: String?
        var stateCode: String
        var limit: Int

        static func ca(packetCountyFips: String? = nil) -> SessionContext {
            SessionContext(packetCountyFips: packetCountyFips, currentCountyFips: nil, stateCode: "CA", limit: 6)
        }
    }

    init(repository: EBTOffersRepository) {
        self.repository = repository
        self.totalSavingsCents = repository.totalSavingsCents
        self.tallyLastUpdated = repository.tallyLastUpdated
        bind()
        classify(response: repository.lastResponse, fetchedAt: repository.responseFetchedAt, isFresh: false)
    }

    /// Pull-to-refresh + first-mount entry point. Caller passes the user's
    /// packet county (from the auth claim) and current county (when device
    /// location is granted, else nil) per resolver D7 OR-match contract.
    func refresh(
        packetCountyFips: String?,
        currentCountyFips: String?,
        stateCode: String,
        limit: Int = 6
    ) async {
        if case .loading = dealsSection {
            // already loading
        } else if repository.lastResponse == nil {
            dealsSection = .loading
        }
        sessionContext = SessionContext(
            packetCountyFips: packetCountyFips,
            currentCountyFips: currentCountyFips,
            stateCode: stateCode,
            limit: limit
        )
        isLoading = true
        await repository.refresh(
            packetCountyFips: packetCountyFips,
            currentCountyFips: currentCountyFips,
            stateCode: stateCode,
            limit: limit
        )
        isLoading = false
    }

    /// Dashboard convenience: fetches once per session using the
    /// pre-configured `sessionContext`. The dashboard calls this from
    /// `.onAppear`; the guard makes it safe to call repeatedly.
    func fetchIfNeeded() {
        guard !hasFetched, !isLoading else { return }
        hasFetched = true
        Task { [weak self] in
            guard let self else { return }
            await self.refresh(
                packetCountyFips: self.sessionContext.packetCountyFips,
                currentCountyFips: self.sessionContext.currentCountyFips,
                stateCode: self.sessionContext.stateCode,
                limit: self.sessionContext.limit
            )
        }
    }

    /// Self-attest redemption. Removes the redeemed offer from the visible
    /// list immediately (optimistic) and updates the lifetime tally from the
    /// server's authoritative response.
    func redeem(offerId: String, savingsCents: Int) async {
        do {
            _ = try await repository.recordRedemption(offerId: offerId, savingsCents: savingsCents)
            // Drop the redeemed offer from the visible shelf — the user just
            // confirmed they used it; showing it again would feel weird.
            if case .offers(let current) = dealsSection {
                let filtered = current.filter { $0.offerId != offerId }
                dealsSection = filtered.isEmpty ? .empty : .offers(filtered)
                offers = filtered
            }
        } catch {
            // Fail-quiet: the redeem confirm sheet stays open if the request
            // truly errored; common paths (410 OFFER_EXPIRED) are handled by
            // the sheet itself.
        }
    }

    // MARK: - Bindings

    private func bind() {
        // Republish the repository's tally + last-response into the store's
        // own surface so views observe one ObservableObject, not two.
        repository.$lastResponse
            .combineLatest(repository.$responseFetchedAt)
            .receive(on: RunLoop.main)
            .sink { [weak self] response, fetchedAt in
                self?.classify(response: response, fetchedAt: fetchedAt, isFresh: true)
            }
            .store(in: &cancellables)

        repository.$totalSavingsCents
            .receive(on: RunLoop.main)
            .sink { [weak self] cents in self?.totalSavingsCents = cents }
            .store(in: &cancellables)

        repository.$tallyLastUpdated
            .receive(on: RunLoop.main)
            .sink { [weak self] date in self?.tallyLastUpdated = date }
            .store(in: &cancellables)
    }

    private func classify(response: EBTOffersResponse?, fetchedAt: Date?, isFresh: Bool) {
        guard let response else {
            // No data yet — leave .loading set by the caller, or fall to .empty
            // on a stable "no data, no in-flight fetch" state.
            if dealsSection != .loading { dealsSection = .empty }
            offers = []
            freeResources = []
            isDistressed = false
            staleAsOf = nil
            return
        }

        if let fr = response.freeResources, !fr.isEmpty {
            dealsSection = .freeResources(fr)
            offers = []
            freeResources = fr
            isDistressed = true
        } else if !response.offers.isEmpty {
            dealsSection = .offers(response.offers)
            offers = response.offers
            freeResources = []
            isDistressed = false
        } else {
            dealsSection = .empty
            offers = []
            freeResources = []
            isDistressed = false
        }

        // Stale-as-of is non-nil when we're serving cached data from a
        // previous session (responseFetchedAt is set but predates this
        // session's launch). For simplicity, mark non-fresh as stale.
        staleAsOf = isFresh ? nil : fetchedAt
    }
}

// MARK: - Display helpers

extension EBTOffersStore {
    /// Dollars-and-cents string formatted in the active locale. Used by
    /// the "Saved by Civica" tally surface.
    func savingsTallyDisplay() -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        let dollars = Decimal(totalSavingsCents) / Decimal(100)
        return formatter.string(from: dollars as NSDecimalNumber) ?? "$0.00"
    }

    /// Month-string suffix for "Since you joined in {month}".
    func tallyMonthYearDisplay(language: CivicaLanguage) -> String? {
        guard let date = tallyLastUpdated else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: language == .spanish ? "es" : "en")
        f.dateFormat = "MMMM"
        return f.string(from: date)
    }
}
