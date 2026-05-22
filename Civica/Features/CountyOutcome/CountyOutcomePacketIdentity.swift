import Foundation

// Per-install packet identifier used by the County Outcome module.
//
// The enrollment-api isn't yet returning a server-side packet UUID for
// the applicant client (the dashboard reads navigator-scoped packet
// rows). Until that wire-up lands, we synthesize a stable per-install
// UUID and persist it. When the real packet id is available, callers
// can override via the optional setter — local records keyed under
// the synthesized id will continue to read back correctly because the
// CountyOutcomeClient stores per-packetId.
//
// Wire-up TODO: replace synthesis with the value returned from
// /me/packets after enrollment-api adds the applicant-scope endpoint.

enum CountyOutcomePacketIdentity {
    /// UserDefaults key holding the active packet id.
    static let storageKey = "co.civica.countyOutcome.packetId"

    /// Returns the current packet id, synthesizing + persisting a UUID
    /// the first time it's read.
    static func currentPacketId(defaults: UserDefaults = .standard) -> String {
        if let stored = defaults.string(forKey: storageKey), !stored.isEmpty {
            return stored
        }
        let fresh = UUID().uuidString
        defaults.set(fresh, forKey: storageKey)
        return fresh
    }

    /// Override the packet id (e.g. once the enrollment-api returns a
    /// real server-side identifier). No-op if the new value matches
    /// the stored value.
    static func setPacketId(_ id: String, defaults: UserDefaults = .standard) {
        defaults.set(id, forKey: storageKey)
    }
}
