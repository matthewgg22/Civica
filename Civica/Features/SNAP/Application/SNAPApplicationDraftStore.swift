import Foundation

// Persistence boundary for the application orchestrator. Owns the
// JSON encode/decode + UserDefaults read/write for the user's draft
// answers and resume target. Separated from the orchestrator view
// model so persistence is independently testable and so the view
// model stays focused on flow logic.
//
// Resume semantics:
//
//   • A user who killed the app mid-flow returns at the same
//     sequential section they were on, with their saved answers
//     visible when they re-enter that section.
//   • A user who hit "Generate my application packet" (mode =
//     .review at kill time) returns to the review surface, where
//     every section's prior answers are still visible.
//   • The transient .editing mode is intentionally NOT persisted —
//     a user who killed mid-edit returns to .review rather than
//     to the half-edited sub-flow. Less surprising on resume.
//
// Multi-draft support: the Recertification Companion's Phantom
// Recert needs a second draft slot for the shadow run that lives
// alongside the live submission-bound draft. We support that by
// keying the UserDefaults slot at init time. Existing call sites
// keep their default-key behavior unchanged.

// Intentionally NOT @MainActor. The store reads/writes JSON to
// UserDefaults — neither operation requires main-actor isolation.
// Keeping it non-isolated lets the orchestrator view model's
// default `init(store: = SNAPApplicationDraftStore())` parameter
// evaluate cleanly from any context.

// MARK: - Error type

/// Typed errors from SNAPApplicationDraftStore.loadResult().
///
/// Pre-IS-9 the store collapsed every failure to nil, making schema
/// mismatches after an app upgrade indistinguishable from "no draft"
/// — the entry view silently flipped Resume → Start. Typed errors let
/// the entry view render an explicit fallback card instead.
enum DraftLoadError: Error {
    /// No draft was ever saved — the normal "new user" state.
    case empty
    /// The JSON decoded but the shape doesn't match PersistedState —
    /// e.g. a field was renamed or changed type in a new app version.
    /// The associated value is the current app version string for
    /// telemetry bucketing.
    case schemaMismatch(version: String)
    /// The data loader (UserDefaults.data(forKey:)) itself threw —
    /// e.g. a sandboxing or disk-read error.
    case ioError(underlying: Error)
    /// The bytes were present but couldn't be parsed as JSON at all —
    /// e.g. truncated write, storage corruption.
    case decodingError(underlying: Error)
}

// MARK: - Store

final class SNAPApplicationDraftStore {
    enum PersistedMode: String, Codable {
        case sequential
        case review
        /// Recertification Companion's shadow run. Behaves like
        /// .sequential for restore purposes; orchestrators
        /// constructed in phantom mode use this so the persisted
        /// state round-trips cleanly to phantom on relaunch.
        case phantom
    }

    struct PersistedState: Codable, Equatable {
        var draft: SNAPApplicationDraft
        var mode: PersistedMode
        /// Only meaningful when mode == .sequential or .phantom; nil otherwise.
        var sequentialSection: SNAPApplicationSection?
    }

    /// Default storage key for the live, submission-bound draft.
    /// Stable string preserves backward compatibility with existing
    /// persisted state for users upgrading to a build with the
    /// keyed API.
    static let liveDraftKey = "co.civica.applicationDraft"

    /// Phantom Recert's shadow-draft slot. Distinct from the live
    /// key so the two drafts don't trample each other.
    static let phantomDraftKey = "co.civica.applicationDraft.phantom"

    private let defaults: UserDefaults
    private let storageKey: String
    // Injectable data loader — real code reads UserDefaults; tests
    // can inject a throwing closure to exercise .ioError.
    private let dataLoader: (String) throws -> Data?

    init(
        defaults: UserDefaults = .standard,
        storageKey: String = SNAPApplicationDraftStore.liveDraftKey,
        dataLoader: ((String) throws -> Data?)? = nil
    ) {
        self.defaults = defaults
        self.storageKey = storageKey
        self.dataLoader = dataLoader ?? { key in defaults.data(forKey: key) }
    }

    // MARK: - Typed load

    /// Returns the persisted state as a typed Result.
    ///
    /// Switch on the failure case to decide how to surface the error:
    ///   .empty          → no draft exists; normal new-user state
    ///   .schemaMismatch → draft exists but is from an older schema
    ///   .ioError        → disk read failed
    ///   .decodingError  → bytes present but not parseable JSON
    func loadResult() -> Result<PersistedState, DraftLoadError> {
        let data: Data?
        do {
            data = try dataLoader(storageKey)
        } catch {
            return .failure(.ioError(underlying: error))
        }

        guard let data else {
            return .failure(.empty)
        }

        do {
            let state = try JSONDecoder().decode(PersistedState.self, from: data)
            return .success(state)
        } catch let decodingError as DecodingError {
            switch decodingError {
            case .dataCorrupted:
                return .failure(.decodingError(underlying: decodingError))
            case .typeMismatch, .keyNotFound, .valueNotFound:
                let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
                return .failure(.schemaMismatch(version: version))
            @unknown default:
                return .failure(.decodingError(underlying: decodingError))
            }
        } catch {
            return .failure(.decodingError(underlying: error))
        }
    }

    // MARK: - Legacy shim

    /// Loads the persisted draft, returning nil for any error condition.
    ///
    /// Prefer `loadResult()` when you need to distinguish a no-draft
    /// state from a load-failure state. This `load()` convenience
    /// wrapper collapses both cases to `nil` — perfectly fine for
    /// the ~27 call sites that just want "do I have a draft to
    /// resume?" The earlier `@available(*, deprecated)` annotation
    /// flagged them all as warnings without offering a clean
    /// migration path; treating both methods as supported is the
    /// honest design.
    func load() -> PersistedState? {
        switch loadResult() {
        case .success(let state): return state
        case .failure: return nil
        }
    }

    func save(_ state: PersistedState) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: storageKey)
    }

    func clear() {
        defaults.removeObject(forKey: storageKey)
    }
}
