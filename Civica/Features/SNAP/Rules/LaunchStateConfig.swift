import Foundation

// Server-side feature-flag cache for the active "launch state" the
// app defaults to when no per-draft state has been captured yet.
//
// As of 2026-05-13 the launch state is California (the CA mass-market
// beachhead). As of 2026-05-27 a parallel MA caseworker-mode pilot
// landed (Project Bread design partner) — when MA-pilot builds ship,
// they flip this cache to "MA" so the surfaces under launchStateCode
// fall back to MA copy instead of CA copy.
//
// Lifecycle:
//   * Stored in UserDefaults under
//     `co.civica.featureFlags.launch_state_code`.
//   * On first read (no cached value) defaults to "CA" — matches the
//     2026-05-13 launch-state decision.
//   * `refresh()` performs an unauthenticated GET against
//     `/v1/enrollment/feature-flags` and writes the result into the
//     cache. Mirrors LPIEFeatureFlag.refresh shape so they can be
//     invoked side-by-side from scene-phase transitions.
//   * Network errors are SILENT — never block app behavior on a flag
//     fetch. The previously-cached value is preserved.
//
// Tests + operators can flip the active value via setCachedValue() —
// the same hook that the server flag uses.
//
// Supported values match SNAPAgencyDirectory's supported states:
// "CA" + "MA". Any other value silently falls back to "CA" so a
// misconfigured server response can't strand the app in an unknown
// state.

enum LaunchStateConfig {

    static let cacheKey: String = "co.civica.featureFlags.launch_state_code"

    /// Supported launch states. Matches SNAPAgencyDirectory's switch
    /// statements + `supportedStateCodes`. Adding a new state means:
    ///   1. Add it here.
    ///   2. Add a case to SNAPAgencyDirectory + SNAPStateResources.
    ///   3. Drop in a `snap_eligibility_<state>.json` profile.
    ///   4. Add `case "XX": return JsonDrivenStateRules(stateCode: "XX")`
    ///      to SNAPRulesRegistry.
    static let supported: Set<String> = ["CA", "MA"]

    /// Default when no cached value is present. Matches the launch-state
    /// decision recorded in `project_launch_state_ca`.
    static let defaultStateCode: String = "CA"

    nonisolated(unsafe) private static var store: UserDefaults = .standard

    /// Replace the backing store. Call from test setup.
    static func setStore(_ newStore: UserDefaults) {
        store = newStore
    }

    /// Reset to the process-default standard UserDefaults. Pair with
    /// `setStore(_:)` in test teardown.
    static func resetStoreToStandard() {
        store = .standard
    }

    /// Current active launch state. Returns the cached value when it
    /// is in `supported`; otherwise the safe default ("CA").
    static var current: String {
        guard let raw = store.string(forKey: cacheKey)?.uppercased(),
              supported.contains(raw) else {
            return defaultStateCode
        }
        return raw
    }

    /// Overwrite the cached value. Used by `refresh` and by tests /
    /// operators flipping pilot builds to MA.
    static func setCachedValue(_ stateCode: String) {
        store.set(stateCode.uppercased(), forKey: cacheKey)
    }

    /// Clear any cached value so the next read returns `defaultStateCode`.
    /// Used by tests + a future "reset to defaults" debug action.
    static func clearCachedValue() {
        store.removeObject(forKey: cacheKey)
    }

    /// Refresh the cache from the enrollment API. Silently no-ops on
    /// network error, unexpected response shape, or unsupported value.
    /// The previously-cached value (or default) is preserved on any
    /// failure path.
    ///
    /// Mirrors LPIEFeatureFlag.refresh; they can be invoked side-by-side
    /// from `applicationDidBecomeActive` (or the SwiftUI scene-phase
    /// `.active` transition).
    static func refresh(
        baseURL: URL?,
        session: URLSession = .shared
    ) async {
        guard let base = baseURL else { return }
        let url = base.appendingPathComponent("v1/enrollment/feature-flags")

        do {
            let (data, response) = try await session.data(from: url)
            guard
                let http = response as? HTTPURLResponse,
                (200..<300).contains(http.statusCode)
            else { return }

            struct Payload: Decodable {
                let launch_state_code: String?
            }
            let payload = try JSONDecoder().decode(Payload.self, from: data)
            if let value = payload.launch_state_code,
               supported.contains(value.uppercased()) {
                setCachedValue(value)
            }
            // Unsupported value or nil → keep previous cached value.
        } catch {
            return
        }
    }
}
