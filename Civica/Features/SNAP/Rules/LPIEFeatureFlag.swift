import Foundation

// Session A — server-side feature-flag cache for the CA LPIE student-
// exemption override. Both `CAStateRules.studentExemption(for:asOf:)`
// and the bilingual exemption description copy read from this cache
// at decision time.
//
// Lifecycle:
//   * The cache value is stored in UserDefaults under the key
//     `co.civica.featureFlags.lpie_auto_exempt_enabled`.
//   * On first read (no cached value) the flag defaults to TRUE — this
//     matches the seeded value in the `feature_flags` migration so a
//     cold-launch user before the first network refresh still sees the
//     LPIE override (consistent with web + dashboard behavior).
//   * `refresh()` performs an unauthenticated GET against
//     `/v1/enrollment/feature-flags` and writes the result into the
//     cache. Callers should invoke this from `applicationDidBecomeActive`
//     (or equivalent SwiftUI scene-phase transition into `.active`).
//   * Network errors are SILENT — we never block app behavior on a flag
//     fetch. The previously-cached value is preserved.
//
// This file deliberately avoids any direct dependency on the Civica
// network stack so the rules layer (which is unit-tested in isolation)
// has no compile-time edge into the rest of the app.

enum LPIEFeatureFlag {

    /// UserDefaults key. Public so tests can inject overrides via
    /// UserDefaults(suiteName:) if needed.
    static let cacheKey: String = "co.civica.featureFlags.lpie_auto_exempt_enabled"

    /// Cache store. Tests override this via `setStore(_:)` to use an
    /// isolated UserDefaults suite and avoid cross-test bleed.
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

    /// Current cached value. Returns `true` when no value has ever been
    /// written (matches the server-side default).
    static var isEnabled: Bool {
        if store.object(forKey: cacheKey) == nil {
            return true
        }
        return store.bool(forKey: cacheKey)
    }

    /// Overwrite the cached value. Used by `refresh` and by tests.
    static func setCachedValue(_ enabled: Bool) {
        store.set(enabled, forKey: cacheKey)
    }

    /// Refresh the cache from the enrollment API. Silently no-ops on
    /// network error or unexpected response shape; the previously-cached
    /// value (or default true) is preserved.
    ///
    /// `baseURL` is the enrollment-api origin
    /// (e.g. https://civica-enrollment-api.fly.dev). Pass nil to fall
    /// back to a build-time default if the host wires one up.
    ///
    /// `session` defaults to URLSession.shared; tests inject a
    /// URLProtocol-backed session.
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
                let lpie_auto_exempt_enabled: Bool?
            }
            let payload = try JSONDecoder().decode(Payload.self, from: data)
            if let value = payload.lpie_auto_exempt_enabled {
                setCachedValue(value)
            }
        } catch {
            // Silent — keep the previous cached value (or default true).
            return
        }
    }
}
