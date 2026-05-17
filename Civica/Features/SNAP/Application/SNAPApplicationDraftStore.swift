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

    init(defaults: UserDefaults = .standard, storageKey: String = SNAPApplicationDraftStore.liveDraftKey) {
        self.defaults = defaults
        self.storageKey = storageKey
    }

    func load() -> PersistedState? {
        guard let data = defaults.data(forKey: storageKey) else { return nil }
        return try? JSONDecoder().decode(PersistedState.self, from: data)
    }

    func save(_ state: PersistedState) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: storageKey)
    }

    func clear() {
        defaults.removeObject(forKey: storageKey)
    }
}
