import Foundation
import Security

// Keychain-backed store for the user's most recent SNAP eligibility
// result. The verdict + benefit amount + contributing factors
// constitute a partial record of recipient assistance under 7 USC
// 2020(e)(8) and 7 CFR 272.1(c); a UserDefaults plist (per-app
// sandbox, no per-item protection class, visible in unencrypted
// iTunes backups) is the wrong home for it. Keychain provides
// per-item access control and never leaves the device.
//
// Access class: kSecAttrAccessibleWhenUnlockedThisDeviceOnly --
// readable only while the device is unlocked, never migrated to
// a new device via backup. Synchronizable=false keeps it off
// iCloud Keychain entirely.
//
// Per OBBBA audit Q11 (Revision 2 disposition: Keychain selected
// over NSFileProtectionComplete because the payload is small JSON
// and per-item attribute control matters more than file-level
// protection here).

enum SNAPEligibilityResultKeychainStore {

    /// Service identifier — namespaces our Keychain items so they
    /// can be wiped en masse without colliding with other Civica
    /// or system entries.
    static let service = "co.civica.SNAP"

    /// Account identifier within the service — only one eligibility
    /// result lives in the store at a time.
    static let account = "eligibilityResult"

    /// Loads the persisted eligibility result, or nil if none is
    /// stored. JSON decoding failures (e.g., model migration) also
    /// produce nil — the caller should treat that as "no verdict
    /// available" and start fresh.
    static func load() -> SNAPEligibilityResult? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SNAPEligibilityResult.self, from: data)
    }

    /// Writes the eligibility result to Keychain, overwriting any
    /// prior value. Encoding failures are silently dropped — the
    /// caller's in-memory copy remains; persistence is best-effort.
    static func save(_ result: SNAPEligibilityResult) {
        guard let data = try? JSONEncoder().encode(result) else { return }
        // Delete first so the protection-class attributes are
        // re-applied on every write (Update doesn't refresh them).
        delete()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String: false,
            kSecValueData as String: data
        ]
        SecItemAdd(attributes as CFDictionary, nil)
    }

    /// Removes the eligibility result from Keychain. Idempotent.
    static func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: false
        ]
        SecItemDelete(query as CFDictionary)
    }
}
