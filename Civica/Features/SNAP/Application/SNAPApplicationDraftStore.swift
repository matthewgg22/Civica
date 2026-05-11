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

@MainActor
final class SNAPApplicationDraftStore {
    enum PersistedMode: String, Codable {
        case sequential
        case review
    }

    struct PersistedState: Codable, Equatable {
        var draft: SNAPApplicationDraft
        var mode: PersistedMode
        /// Only meaningful when mode == .sequential; nil otherwise.
        var sequentialSection: SNAPApplicationSection?
    }

    private let defaults: UserDefaults
    private let storageKey = "co.civica.applicationDraft"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
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
