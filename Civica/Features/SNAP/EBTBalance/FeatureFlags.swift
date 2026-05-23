import Foundation

// Feature-flag surface for the EBT tracker rollout. Per plan IRON RULE
// (regression-critical): with `ebtRealData == false`, the fixture-only
// experience must behave identically to pre-plan. This flag gates the
// new repository/API path; everything still routes through the
// fixtures at flag-OFF.
//
// Storage: UserDefaults key `co.civica.ebt.realData`. Default = false.
// We don't use @AppStorage at the store layer because the value is
// read from non-MainActor contexts (Repository init); UserDefaults is
// thread-safe in Foundation.

enum FeatureFlags {
    static let ebtRealDataKey = "co.civica.ebt.realData"

    /// True when the real-data wire (API client + repository) should be
    /// used. False (default) preserves the fixture-only path.
    static var ebtRealData: Bool {
        UserDefaults.standard.bool(forKey: ebtRealDataKey)
    }

    /// Test helper — explicit setter so feature-flag regression tests
    /// can toggle the flag without leaking into the global default
    /// across runs. Production code does not call this.
    static func setEBTRealData(_ enabled: Bool, defaults: UserDefaults = .standard) {
        defaults.set(enabled, forKey: ebtRealDataKey)
    }

    /// Test helper — clears the flag entirely (returns to "not set"
    /// state, which `bool(forKey:)` interprets as false).
    static func resetEBTRealData(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: ebtRealDataKey)
    }
}
