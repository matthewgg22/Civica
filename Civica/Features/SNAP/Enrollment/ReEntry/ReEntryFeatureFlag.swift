import Foundation

// Feature-flag surface for the re-entry assist rollout (G2, Unrath retention
// pillar). Per the iOS conventions in CLAUDE.md, the flag defaults OFF so
// pre-feature behavior is preserved until the staff dashboard + iOS card
// are validated against a real returning-applicant cohort.
//
// Storage: UserDefaults key `co.civica.reentry.enabled`. Mirrors the
// EBT FeatureFlags pattern (Civica/Features/SNAP/EBTBalance/FeatureFlags.swift).

enum ReEntryFeatureFlag {
    static let enabledKey = "co.civica.reentry.enabled"

    /// True when the re-entry assist card should be shown and the API
    /// endpoints should be called. False (default) keeps the pre-feature
    /// behavior identical.
    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
    }

    /// Test helper — explicit setter so feature-flag tests can toggle
    /// without leaking into the global default across runs. Production
    /// code does not call this.
    static func setEnabled(_ enabled: Bool, defaults: UserDefaults = .standard) {
        defaults.set(enabled, forKey: enabledKey)
    }

    /// Test helper — clears the flag (returns to false default).
    static func reset(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: enabledKey)
    }
}
