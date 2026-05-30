import Foundation
import Testing
@testable import Civica

// Regression for IS-9 (iOS audit 2026-05-29) — typed
// Result<PersistedState, DraftLoadError> from SNAPApplicationDraftStore.
//
// Before this change, `load()` collapsed every decode failure into nil.
// A schema-bumped persisted state (renamed field, type change after an
// app upgrade) looked identical to "no draft on disk" — so the entry
// view flipped Resume → Start and silently destroyed the user's saved
// progress.
//
// `loadResult()` surfaces the variant so the entry view can render the
// fallback card with "Re-run the screener" instead. These tests
// exercise each variant; if any one collapses back to .empty the regression
// is back.

struct SNAPApplicationDraftLoadResultTests {

    // MARK: - Helpers

    private func makeDefaults() -> UserDefaults {
        let suite = "test.civica.snap.draft.loadresult.\(UUID().uuidString)"
        return UserDefaults(suiteName: suite)!
    }

    // MARK: - Empty (no draft on disk)

    @Test func loadResultReturnsEmptyWhenNothingPersisted() {
        let store = SNAPApplicationDraftStore(defaults: makeDefaults())
        let result = store.loadResult()
        guard case .failure(let error) = result, case .empty = error else {
            Issue.record("Expected .failure(.empty), got \(result)")
            return
        }
    }

    // MARK: - Success round-trip

    @Test func loadResultReturnsSuccessWhenDraftIsValid() {
        let defaults = makeDefaults()
        let store = SNAPApplicationDraftStore(defaults: defaults)

        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        let persisted = SNAPApplicationDraftStore.PersistedState(
            draft: draft,
            mode: .sequential,
            sequentialSection: .income
        )
        store.save(persisted)

        let result = store.loadResult()
        guard case .success(let loaded) = result else {
            Issue.record("Expected .success, got \(result)")
            return
        }
        #expect(loaded.draft.whereApplying.stateCode == "CA")
        #expect(loaded.mode == .sequential)
        #expect(loaded.sequentialSection == .income)
    }

    // MARK: - Schema mismatch (valid JSON, wrong structure)

    @Test func loadResultReturnsSchemaMismatchOnTypeMismatch() {
        let defaults = makeDefaults()
        // Valid JSON, wrong shape — `draft` is a string, not a
        // SNAPApplicationDraft. Simulates an upgrade where a top-level
        // field changed type.
        let badPayload = #"{"draft":"not-a-draft","mode":"sequential","sequentialSection":null}"#
            .data(using: .utf8)!
        defaults.set(badPayload, forKey: SNAPApplicationDraftStore.liveDraftKey)
        let store = SNAPApplicationDraftStore(defaults: defaults)

        let result = store.loadResult()
        guard case .failure(let error) = result, case .schemaMismatch(let version) = error else {
            Issue.record("Expected .failure(.schemaMismatch), got \(result)")
            return
        }
        #expect(!version.isEmpty)
    }

    @Test func loadResultReturnsSchemaMismatchOnMissingRequiredKey() {
        let defaults = makeDefaults()
        // Missing the required `mode` key → KeyNotFound → schema mismatch.
        let badPayload = #"{"draft":{}}"#.data(using: .utf8)!
        defaults.set(badPayload, forKey: SNAPApplicationDraftStore.liveDraftKey)
        let store = SNAPApplicationDraftStore(defaults: defaults)

        let result = store.loadResult()
        guard case .failure(let error) = result, case .schemaMismatch = error else {
            Issue.record("Expected .failure(.schemaMismatch), got \(result)")
            return
        }
    }

    // MARK: - Decoding error (truly corrupted bytes)

    @Test func loadResultReturnsDecodingErrorWhenBytesAreNotJSON() {
        let defaults = makeDefaults()
        // Random non-JSON bytes → dataCorrupted → decodingError.
        defaults.set(Data([0xFF, 0xFE, 0xC3, 0x28]), forKey: SNAPApplicationDraftStore.liveDraftKey)
        let store = SNAPApplicationDraftStore(defaults: defaults)

        let result = store.loadResult()
        guard case .failure(let error) = result, case .decodingError = error else {
            Issue.record("Expected .failure(.decodingError), got \(result)")
            return
        }
    }

    // MARK: - IO error (injected throwing loader)

    @Test func loadResultReturnsIOErrorWhenDataLoaderThrows() {
        struct TestIOError: Error {}
        let store = SNAPApplicationDraftStore(
            defaults: makeDefaults(),
            dataLoader: { _ in throw TestIOError() }
        )

        let result = store.loadResult()
        guard case .failure(let error) = result, case .ioError = error else {
            Issue.record("Expected .failure(.ioError), got \(result)")
            return
        }
    }

    // MARK: - Deprecation shim parity

    /// Wrapper to silence the deprecation warning at the call site —
    /// the test exists precisely to verify the shim still collapses to
    /// nil for callers that haven't migrated to loadResult() yet.
    @available(*, deprecated)
    private func callDeprecatedLoad(_ store: SNAPApplicationDraftStore) -> SNAPApplicationDraftStore.PersistedState? {
        store.load()
    }

    @Test func deprecatedLoadReturnsNilOnDecodingFailure() {
        let defaults = makeDefaults()
        defaults.set(Data([0xFF, 0xFE]), forKey: SNAPApplicationDraftStore.liveDraftKey)
        let store = SNAPApplicationDraftStore(defaults: defaults)
        #expect(callDeprecatedLoad(store) == nil)
    }

    @Test func deprecatedLoadReturnsValueOnSuccess() {
        let store = SNAPApplicationDraftStore(defaults: makeDefaults())
        store.save(SNAPApplicationDraftStore.PersistedState(
            draft: SNAPApplicationDraft(),
            mode: .review,
            sequentialSection: nil
        ))
        #expect(callDeprecatedLoad(store) != nil)
    }
}
