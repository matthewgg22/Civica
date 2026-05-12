import Foundation
import SwiftUI

// Persisted store for the user's current SNAP application status.
//
// Storage: UserDefaults via @AppStorage on the host view. We persist
// the raw enum string plus a timestamp for when each milestone fired
// (used by the timeline UI to show "Apr 14" / "Today" / etc).
//
// Why @MainActor: SwiftUI reads + status transitions happen on the
// main thread. Backend sync (Phase D HTTP layer) will be wrapped in
// async functions that hop main when they commit results.

@MainActor
final class SNAPApplicationStatusStore: ObservableObject {
    @Published private(set) var status: SNAPApplicationStatus
    @Published private(set) var milestones: [SNAPApplicationStatus: Date]
    /// The most-recent eligibility verdict for this user. Set when the
    /// orchestrator completes and the local evaluator returns a result;
    /// surfaced on the returning-user-home so users who reopen the app
    /// see "your previous result was..." instead of being restarted
    /// from zero. Persisted alongside status + milestones.
    @Published private(set) var eligibilityResult: SNAPEligibilityResult?

    // Keys used for UserDefaults persistence. Defined here rather than
    // @AppStorage so the wrapping ObservableObject can re-emit on
    // change without each SwiftUI view re-reading defaults directly.
    //
    // Note: the eligibility-result payload moved to Keychain (per
    // OBBBA audit Q11). The legacy UserDefaults key is read once
    // during init for migration, then permanently deleted. App
    // launch instantiates this store once via
    // CivicaUserData.runLaunchTimeMigrations, so the migration runs
    // even on installs that never visit a SNAP screen during the
    // first launch after upgrade.
    private let statusKey = "co.civica.applicationStatus"
    private let milestonesKey = "co.civica.applicationMilestones"
    static let legacyEligibilityResultUserDefaultsKey = "co.civica.eligibilityResult"

    init() {
        let defaults = UserDefaults.standard
        let raw = defaults.string(forKey: statusKey) ?? SNAPApplicationStatus.notStarted.rawValue
        self.status = SNAPApplicationStatus(rawValue: raw) ?? .notStarted

        if let data = defaults.data(forKey: milestonesKey),
           let decoded = try? JSONDecoder().decode([String: Date].self, from: data) {
            var rehydrated: [SNAPApplicationStatus: Date] = [:]
            for (key, date) in decoded {
                if let status = SNAPApplicationStatus(rawValue: key) {
                    rehydrated[status] = date
                }
            }
            self.milestones = rehydrated
        } else {
            self.milestones = [:]
        }

        // Eligibility result: Keychain is the new home. If a legacy
        // UserDefaults value exists, migrate it into Keychain and
        // remove the plist entry so subsequent launches read only
        // from Keychain. New installs skip the migration branch.
        if let keychainResult = SNAPEligibilityResultKeychainStore.load() {
            self.eligibilityResult = keychainResult
            // Belt-and-suspenders: if a stale plist value lingered
            // through a partial migration, clear it now.
            defaults.removeObject(forKey: Self.legacyEligibilityResultUserDefaultsKey)
        } else if let legacyData = defaults.data(forKey: Self.legacyEligibilityResultUserDefaultsKey),
                  let migrated = try? JSONDecoder().decode(SNAPEligibilityResult.self, from: legacyData) {
            SNAPEligibilityResultKeychainStore.save(migrated)
            defaults.removeObject(forKey: Self.legacyEligibilityResultUserDefaultsKey)
            self.eligibilityResult = migrated
        } else {
            self.eligibilityResult = nil
        }
    }

    /// Advance to a new status; records the timestamp as a milestone.
    /// Pure transition function — no side effects beyond persistence.
    func advance(to next: SNAPApplicationStatus, on date: Date = Date()) {
        status = next
        milestones[next] = date
        persist()
    }

    /// Record the eligibility result and advance status to
    /// .screenerComplete in one transition. Called by the orchestrator
    /// when the local evaluator returns a verdict — this closes the
    /// loop so subsequent app launches route the user to the returning-
    /// user home with their verdict already visible.
    func recordEligibilityResult(_ result: SNAPEligibilityResult, on date: Date = Date()) {
        eligibilityResult = result
        status = .screenerComplete
        milestones[.screenerComplete] = date
        persist()
    }

    /// Reset the application back to not-started. Used by "start over"
    /// flows and after the user explicitly deletes their application.
    func reset() {
        status = .notStarted
        milestones.removeAll()
        eligibilityResult = nil
        persist()
    }

    func timestamp(for status: SNAPApplicationStatus) -> Date? {
        milestones[status]
    }

    // MARK: - Internal

    private func persist() {
        let defaults = UserDefaults.standard
        defaults.set(status.rawValue, forKey: statusKey)

        let encodable: [String: Date] = Dictionary(
            uniqueKeysWithValues: milestones.map { ($0.key.rawValue, $0.value) }
        )
        if let data = try? JSONEncoder().encode(encodable) {
            defaults.set(data, forKey: milestonesKey)
        }

        // Eligibility result persists to Keychain, never UserDefaults.
        // See OBBBA audit Q11 and SNAPEligibilityResultKeychainStore.
        if let result = eligibilityResult {
            SNAPEligibilityResultKeychainStore.save(result)
        } else {
            SNAPEligibilityResultKeychainStore.delete()
        }
    }
}
