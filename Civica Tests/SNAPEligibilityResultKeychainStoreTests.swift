import Foundation
import Security
import Testing
@testable import Civica

// Tests for the OBBBA Q11 remediation: the user's eligibility verdict
// + benefit amount + contributing factors move out of UserDefaults
// into iOS Keychain. These tests cover the round-trip, the protection
// attributes, the deletion path, and the one-shot migration from
// the legacy UserDefaults entry.
//
// Each test wipes the Keychain entry before and after itself so test
// order doesn't matter and reruns are clean.
//
// CI gating: GitHub Actions runs xcodebuild with CODE_SIGNING_ALLOWED=NO.
// On unsigned simulator bundles, SecItemAdd returns errSecMissingEntitle
// ment (-34018) because the binary has no embedded entitlements section.
// `keychainAvailableForTests` probes Keychain once at suite load; when
// false (CI), the suite is disabled and the tests run only in Xcode
// locally (signed dev cert). Production Keychain works on signed
// builds (TestFlight / release / dev) -- the gap is unit-test
// reach, not security posture.

/// Runtime probe — true when the current environment can write/read
/// the data-protection keychain. Computed once on first reference.
let keychainAvailableForTests: Bool = {
    let probeService = "co.civica.SNAP.keychainProbe"
    let probeAccount = "probe"
    let delete: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: probeService,
        kSecAttrAccount as String: probeAccount,
        kSecUseDataProtectionKeychain as String: true
    ]
    SecItemDelete(delete as CFDictionary)
    let add: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: probeService,
        kSecAttrAccount as String: probeAccount,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecAttrSynchronizable as String: false,
        kSecUseDataProtectionKeychain as String: true,
        kSecValueData as String: Data([0])
    ]
    let status = SecItemAdd(add as CFDictionary, nil)
    SecItemDelete(delete as CFDictionary)
    return status == errSecSuccess
}()

@Suite(.enabled(if: keychainAvailableForTests))
struct SNAPEligibilityResultKeychainStoreTests {

    // MARK: - Round-trip

    @Test func saveAndLoadRoundTripPreservesResult() {
        SNAPEligibilityResultKeychainStore.delete()
        defer { SNAPEligibilityResultKeychainStore.delete() }

        let sample = Self.makeSampleResult()
        SNAPEligibilityResultKeychainStore.save(sample)

        let loaded = SNAPEligibilityResultKeychainStore.load()
        #expect(loaded?.status == sample.status)
        #expect(loaded?.monthlyBenefit == sample.monthlyBenefit)
        #expect(loaded?.rulesVersion == sample.rulesVersion)
        #expect(loaded?.contributingFactors == sample.contributingFactors)
    }

    @Test func loadReturnsNilWhenEmpty() {
        SNAPEligibilityResultKeychainStore.delete()
        #expect(SNAPEligibilityResultKeychainStore.load() == nil)
    }

    @Test func deleteIsIdempotent() {
        SNAPEligibilityResultKeychainStore.delete()
        // Calling delete on an empty slot must not raise or otherwise
        // misbehave -- it's the migration cleanup pattern.
        SNAPEligibilityResultKeychainStore.delete()
        #expect(SNAPEligibilityResultKeychainStore.load() == nil)
    }

    // MARK: - Protection-class attributes (OBBBA Q11)

    @Test func storedItemUsesWhenUnlockedThisDeviceOnly() throws {
        SNAPEligibilityResultKeychainStore.delete()
        defer { SNAPEligibilityResultKeychainStore.delete() }

        SNAPEligibilityResultKeychainStore.save(Self.makeSampleResult())

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: SNAPEligibilityResultKeychainStore.service,
            kSecAttrAccount as String: SNAPEligibilityResultKeychainStore.account,
            kSecAttrSynchronizable as String: false,
            kSecUseDataProtectionKeychain as String: true,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        #expect(status == errSecSuccess)

        let attrs = item as? [String: Any]
        // kSecAttrAccessible round-trips as a String literal that
        // matches the constant we set; bridging through CFString.
        let accessible = attrs?[kSecAttrAccessible as String] as? String
        let expected = kSecAttrAccessibleWhenUnlockedThisDeviceOnly as String
        #expect(accessible == expected,
                "Eligibility-result Keychain item must use WhenUnlockedThisDeviceOnly; got \(accessible ?? "nil")")

        // Synchronizable=false means the attribute round-trips as
        // either missing or explicitly false; absence is acceptable.
        if let sync = attrs?[kSecAttrSynchronizable as String] as? Bool {
            #expect(sync == false)
        }
    }

    // MARK: - One-shot UserDefaults -> Keychain migration

    @MainActor
    @Test func storeInitMigratesLegacyUserDefaultsValueToKeychain() throws {
        let legacyKey = SNAPApplicationStatusStore.legacyEligibilityResultUserDefaultsKey
        let defaults = UserDefaults.standard

        // Reset both sides so we're starting from a known state.
        SNAPEligibilityResultKeychainStore.delete()
        defaults.removeObject(forKey: legacyKey)
        defer {
            SNAPEligibilityResultKeychainStore.delete()
            defaults.removeObject(forKey: legacyKey)
        }

        // Simulate a pre-migration install: legacy JSON in UserDefaults,
        // nothing in Keychain.
        let sample = Self.makeSampleResult()
        let encoded = try JSONEncoder().encode(sample)
        defaults.set(encoded, forKey: legacyKey)
        #expect(defaults.data(forKey: legacyKey) != nil)

        // Instantiating the store triggers the migration branch.
        let store = SNAPApplicationStatusStore()

        // In-memory state reflects the migrated verdict.
        #expect(store.eligibilityResult?.monthlyBenefit == sample.monthlyBenefit)
        #expect(store.eligibilityResult?.rulesVersion == sample.rulesVersion)

        // Keychain now holds the verdict.
        #expect(SNAPEligibilityResultKeychainStore.load()?.monthlyBenefit == sample.monthlyBenefit)

        // UserDefaults plist no longer holds the verdict -- the plain-
        // text payload that the audit flagged (7 USC 2020(e)(8)) is
        // gone after the very first launch.
        #expect(defaults.data(forKey: legacyKey) == nil,
                "Legacy UserDefaults entry must be removed after migration")
    }

    @MainActor
    @Test func storeResetDeletesKeychainEntry() {
        SNAPEligibilityResultKeychainStore.delete()
        defer { SNAPEligibilityResultKeychainStore.delete() }

        // Seed Keychain with a verdict, then construct the store and
        // call reset. Keychain must be empty afterward.
        SNAPEligibilityResultKeychainStore.save(Self.makeSampleResult())
        #expect(SNAPEligibilityResultKeychainStore.load() != nil)

        let store = SNAPApplicationStatusStore()
        store.reset()

        #expect(SNAPEligibilityResultKeychainStore.load() == nil,
                "reset() must clear the Keychain eligibility result")
    }

    // MARK: - Helpers

    private static func makeSampleResult() -> SNAPEligibilityResult {
        SNAPEligibilityResult(
            status: .eligible,
            monthlyBenefit: 285,
            expeditedEligible: false,
            contributingFactors: ["ma_bbce_200pct_applied", "gross_under_200_fpl"],
            requiredVerifications: [],
            benefitCalculation: nil,
            ineligibilityReason: nil,
            effectiveDate: "2026-05-12",
            rulesVersion: "MA-bbce-200pct-FY26"
        )
    }
}
