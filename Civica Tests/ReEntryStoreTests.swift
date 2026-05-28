import Foundation
import Testing
@testable import Civica

// Covers G2-3 (Unrath retention pillar) — ReEntryStore state machine
// and orchestration. Pure store tests; the repository is exercised
// via the MockReEntryAPIClient so no UserDefaults or network bleed.
//
// State machine under test:
//   .idle → .loading → .candidate(...) | .noCandidate | .error
//   .candidate → .enrolling → .completed(...) | .error
//   .error → .reset → .idle
//   .candidate → .dismiss → .noCandidate

@MainActor
@Suite("ReEntryStore")
struct ReEntryStoreTests {
    // MARK: - Fixtures

    private static let priorPacket = ReEntrySuggestionResponse.PriorPacket(
        packet_id: "pkt-source-001",
        state_code: "CA",
        county: "Alameda",
        county_fips: "06001",
        closed_at: "2026-04-27T12:00:00Z"
    )

    private static let candidateResponse = ReEntrySuggestionResponse(
        candidate: true,
        days_since_close: 30,
        prior_packet: priorPacket
    )

    private static let nonCandidateResponse = ReEntrySuggestionResponse(
        candidate: false,
        days_since_close: nil,
        prior_packet: nil
    )

    private static let reEnrollResponse = ReEnrollResponse(
        packet: ReEnrollResponse.Packet(
            packet_id: "pkt-new-001",
            status: "Draft",
            state_code: "CA",
            created_at: "2026-05-27T12:00:00Z",
            updated_at: "2026-05-27T12:00:00Z"
        ),
        hydrated: ReEnrollResponse.HydratedCounts(answers: 12),
        idempotent: false
    )

    private func makeStore(
        suggestion: ReEntrySuggestionResponse? = nil,
        suggestionError: Error? = nil,
        reEnroll: ReEnrollResponse? = nil,
        reEnrollError: Error? = nil,
        flagEnabled: Bool = true
    ) -> (ReEntryStore, MockReEntryAPIClient, RecordingReEntryAnalyticsSink) {
        let mock = MockReEntryAPIClient(suggestion: suggestion, reEnroll: reEnroll)
        mock.suggestionError = suggestionError
        mock.reEnrollError = reEnrollError
        let repo = ReEntryRepository(apiClient: mock, isFlagEnabled: { flagEnabled })
        let analytics = RecordingReEntryAnalyticsSink()
        return (ReEntryStore(repository: repo, analytics: analytics), mock, analytics)
    }

    // MARK: - Initial state

    @Test("Fresh store starts in .idle")
    func freshStateIdle() {
        let (store, _, _) = makeStore()
        #expect(store.state == .idle)
    }

    // MARK: - loadSuggestion paths

    @Test("loadSuggestion transitions .idle → .candidate when server returns a candidate")
    func loadCandidate() async {
        let (store, _, _) = makeStore(suggestion: Self.candidateResponse)
        await store.loadSuggestion()
        if case let .candidate(suggestion) = store.state {
            #expect(suggestion.prior_packet?.packet_id == "pkt-source-001")
            #expect(suggestion.days_since_close == 30)
        } else {
            Issue.record("Expected .candidate, got \(store.state)")
        }
    }

    @Test("loadSuggestion transitions .idle → .noCandidate when server returns candidate=false")
    func loadNoCandidate() async {
        let (store, _, _) = makeStore(suggestion: Self.nonCandidateResponse)
        await store.loadSuggestion()
        #expect(store.state == .noCandidate)
    }

    @Test("loadSuggestion transitions to .noCandidate when candidate=true but prior_packet is missing (defensive)")
    func loadCandidateMissingPriorPacket() async {
        let weird = ReEntrySuggestionResponse(
            candidate: true,
            days_since_close: 30,
            prior_packet: nil
        )
        let (store, _, _) = makeStore(suggestion: weird)
        await store.loadSuggestion()
        #expect(store.state == .noCandidate)
    }

    @Test("loadSuggestion transitions to .error on API failure")
    func loadError() async {
        let (store, _, _) = makeStore(
            suggestionError: ReEntryAPIError.http(status: 500, message: "server fault")
        )
        await store.loadSuggestion()
        if case .error = store.state {
            // expected
        } else {
            Issue.record("Expected .error, got \(store.state)")
        }
    }

    @Test("loadSuggestion at flag-OFF short-circuits to .noCandidate without calling the API")
    func loadAtFlagOff() async {
        let (store, mock, _) = makeStore(suggestion: Self.candidateResponse, flagEnabled: false)
        await store.loadSuggestion()
        #expect(store.state == .noCandidate)
        #expect(mock.fetchSuggestionCallCount == 0)
    }

    @Test("loadSuggestion de-dupes — second call from .candidate is a no-op")
    func loadDeDupes() async {
        let (store, mock, _) = makeStore(suggestion: Self.candidateResponse)
        await store.loadSuggestion()
        #expect(mock.fetchSuggestionCallCount == 1)
        await store.loadSuggestion()
        #expect(mock.fetchSuggestionCallCount == 1, "Second loadSuggestion from .candidate should not refetch")
    }

    // MARK: - confirmReEnroll paths

    @Test("confirmReEnroll from .candidate transitions to .completed with the new packet")
    func confirmHappyPath() async {
        let (store, mock, _) = makeStore(
            suggestion: Self.candidateResponse,
            reEnroll: Self.reEnrollResponse
        )
        await store.loadSuggestion()
        await store.confirmReEnroll()
        if case let .completed(packet, idempotent) = store.state {
            #expect(packet.packet_id == "pkt-new-001")
            #expect(packet.status == "Draft")
            #expect(idempotent == false)
            #expect(mock.lastReEnrollPacketId == "pkt-source-001")
        } else {
            Issue.record("Expected .completed, got \(store.state)")
        }
    }

    @Test("confirmReEnroll surfaces idempotent=true when the gateway returned an existing draft")
    func confirmIdempotent() async {
        let idempotentResponse = ReEnrollResponse(
            packet: ReEnrollResponse.Packet(
                packet_id: "pkt-existing",
                status: "Draft",
                state_code: "CA",
                created_at: "2026-05-27T10:00:00Z",
                updated_at: "2026-05-27T10:00:00Z"
            ),
            hydrated: ReEnrollResponse.HydratedCounts(answers: 0),
            idempotent: true
        )
        let (store, _, _) = makeStore(
            suggestion: Self.candidateResponse,
            reEnroll: idempotentResponse
        )
        await store.loadSuggestion()
        await store.confirmReEnroll()
        if case let .completed(_, idempotent) = store.state {
            #expect(idempotent == true)
        } else {
            Issue.record("Expected .completed, got \(store.state)")
        }
    }

    @Test("confirmReEnroll transitions to .error on API failure")
    func confirmError() async {
        let (store, _, _) = makeStore(
            suggestion: Self.candidateResponse,
            reEnrollError: ReEntryAPIError.http(status: 400, message: "stale source")
        )
        await store.loadSuggestion()
        await store.confirmReEnroll()
        if case .error = store.state {
            // expected
        } else {
            Issue.record("Expected .error, got \(store.state)")
        }
    }

    @Test("confirmReEnroll is a no-op when state isn't .candidate")
    func confirmNoOpOutsideCandidate() async {
        let (store, mock, _) = makeStore()  // state stays .idle
        await store.confirmReEnroll()
        #expect(store.state == .idle)
        #expect(mock.lastReEnrollPacketId == nil)
    }

    // MARK: - dismiss + reset

    @Test("dismiss from .candidate transitions to .noCandidate (hides the card for this session)")
    func dismissCard() async {
        let (store, _, _) = makeStore(suggestion: Self.candidateResponse)
        await store.loadSuggestion()
        store.dismiss()
        #expect(store.state == .noCandidate)
    }

    @Test("reset from .error transitions back to .idle so a retry can fetch fresh")
    func resetFromError() async {
        let (store, _, _) = makeStore(
            suggestionError: ReEntryAPIError.transport("network down")
        )
        await store.loadSuggestion()
        if case .error = store.state {
            store.reset()
            #expect(store.state == .idle)
        } else {
            Issue.record("Setup: expected .error before reset")
        }
    }

    @Test("After reset from .error, loadSuggestion can retry against fresh server state")
    func retryAfterError() async {
        let (store, mock, _) = makeStore(
            suggestionError: ReEntryAPIError.transport("network down")
        )
        await store.loadSuggestion()
        #expect(mock.fetchSuggestionCallCount == 1)

        // Simulate network recovered.
        mock.suggestionError = nil
        mock.suggestionResponse = Self.candidateResponse

        store.reset()
        await store.loadSuggestion()
        #expect(mock.fetchSuggestionCallCount == 2)
        if case .candidate = store.state {
            // expected
        } else {
            Issue.record("Expected .candidate after retry, got \(store.state)")
        }
    }

    // MARK: - Analytics emission

    @Test("Emits .impression exactly once when load transitions to .candidate")
    func analyticsImpressionOnCandidate() async {
        let (store, _, sink) = makeStore(suggestion: Self.candidateResponse)
        await store.loadSuggestion()
        #expect(sink.events == [.impression])
    }

    @Test("Does not emit .impression when load transitions to .noCandidate")
    func analyticsNoImpressionOnNonCandidate() async {
        let (store, _, sink) = makeStore(suggestion: Self.nonCandidateResponse)
        await store.loadSuggestion()
        #expect(sink.events.isEmpty)
    }

    @Test("Emits .error(.load) when suggestion fetch fails")
    func analyticsLoadError() async {
        let (store, _, sink) = makeStore(
            suggestionError: ReEntryAPIError.http(status: 500, message: "boom")
        )
        await store.loadSuggestion()
        #expect(sink.events == [.error(stage: .load)])
    }

    @Test("Emits .confirmed(idempotent: false) on a fresh re-enrollment")
    func analyticsConfirmedFresh() async {
        let (store, _, sink) = makeStore(
            suggestion: Self.candidateResponse,
            reEnroll: Self.reEnrollResponse
        )
        await store.loadSuggestion()
        await store.confirmReEnroll()
        #expect(sink.events == [.impression, .confirmed(idempotent: false)])
    }

    @Test("Emits .confirmed(idempotent: true) when gateway returned an existing draft")
    func analyticsConfirmedIdempotent() async {
        let idempotentResponse = ReEnrollResponse(
            packet: ReEnrollResponse.Packet(
                packet_id: "pkt-existing",
                status: "Draft",
                state_code: "CA",
                created_at: "2026-05-27T10:00:00Z",
                updated_at: "2026-05-27T10:00:00Z"
            ),
            hydrated: ReEnrollResponse.HydratedCounts(answers: 0),
            idempotent: true
        )
        let (store, _, sink) = makeStore(
            suggestion: Self.candidateResponse,
            reEnroll: idempotentResponse
        )
        await store.loadSuggestion()
        await store.confirmReEnroll()
        #expect(sink.events == [.impression, .confirmed(idempotent: true)])
    }

    @Test("Emits .error(.enroll) when re-enrollment fails")
    func analyticsEnrollError() async {
        let (store, _, sink) = makeStore(
            suggestion: Self.candidateResponse,
            reEnrollError: ReEntryAPIError.http(status: 400, message: "stale")
        )
        await store.loadSuggestion()
        await store.confirmReEnroll()
        #expect(sink.events == [.impression, .error(stage: .enroll)])
    }

    @Test("Emits .dismissed when the user taps Not now")
    func analyticsDismissed() async {
        let (store, _, sink) = makeStore(suggestion: Self.candidateResponse)
        await store.loadSuggestion()
        store.dismiss()
        #expect(sink.events == [.impression, .dismissed])
    }
}
