import Foundation

// MARK: - C ↔ D bridge
//
// Lane C ships `EBTBalanceAPIClient` (protocol + `HTTPEBTBalanceAPIClient`
// struct + `MockEBTBalanceAPIClient` class). Lane D ships
// `EBTBalancePushAPIClient` + `EBTNotificationPrefsAPIClient` protocols,
// both `AnyObject + Sendable`-bound so the push handler / prefs store
// can hold them as dependencies.
//
// The reason for the bridge: Lane C's prod impl is a `struct` (value
// semantics for test isolation), but Lane D's protocols require
// `AnyObject` (for weak references + store-as-dependency). Adapter class
// holds the struct by value and forwards calls.
//
// This file is the single C ↔ D integration seam — it owns the wiring,
// so Lane C and Lane D files stay decoupled.

/// Adapter that wraps Lane C's `any EBTBalanceAPIClient` (struct or class)
/// and exposes Lane D's two reference-typed protocols.
final class EBTPushClientBridge: EBTBalancePushAPIClient, EBTNotificationPrefsAPIClient, @unchecked Sendable {

    private let client: any EBTBalanceAPIClient

    init(client: any EBTBalanceAPIClient) {
        self.client = client
    }

    // MARK: - EBTBalancePushAPIClient

    func registerPushToken(_ hexToken: String) async throws {
        try await client.registerPushToken(hexToken)
    }

    // MARK: - EBTNotificationPrefsAPIClient

    func updateNotificationPrefs(_ prefs: EBTNotificationPrefsPayload) async throws {
        // C↔D bridge TODO closed by Phase 2 / Lane G:
        // EBTBalanceAPIClient now declares updateNotificationPrefs(_:)
        // and HTTPEBTBalanceAPIClient implements it as
        // POST /ebt/notifications/prefs. Forward the call directly.
        try await client.updateNotificationPrefs(prefs)
    }
}

// MARK: - Install hook

enum EBTPushWiring {
    /// Call once at app startup, after constructing `EBTBalanceAPIClient`,
    /// to wire Lane D's push surfaces to Lane C's gateway client.
    ///
    /// Usage (in CivicaApp or similar startup site):
    /// ```
    /// let apiClient = HTTPEBTBalanceAPIClient(baseURL: ..., tokenProvider: ...)
    /// let prefsStore = EBTNotificationPrefsStore()
    /// EBTPushWiring.install(client: apiClient, prefsStore: prefsStore)
    /// ```
    @MainActor
    static func install(
        client: any EBTBalanceAPIClient,
        prefsStore: EBTNotificationPrefsStore
    ) {
        let bridge = EBTPushClientBridge(client: client)
        EBTPushHandler.shared.setAPIClient(bridge)
        prefsStore.apiClient = bridge
    }
}
