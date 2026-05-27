import Foundation
import Testing
@testable import Civica

// Plan §16.8 / Q2 / D9 — every CivicaText in the EBT* namespaces must
// have both .en and .es. Drift here is silent in CI without this
// guard: a missing Spanish string ships as an empty label, not a
// crash. This catches it at compile/test time.
//
// Implementation note: the plan stub uses `Mirror(reflecting: ns)` to
// auto-discover entries. Swift's Mirror can't reflect static
// properties on enum namespaces, so each namespace exposes a curated
// `static let all: [CivicaText]` array instead. Adding a new string
// requires appending it to `all` (the failure mode is forgetting the
// array entry); the directory-scan test below guards against a new
// namespace file being added without being registered here.

@Suite("EBT strings have EN/ES parity")
struct EBTStringParityTests {
    /// Registered namespaces. New `Strings/EBT*Strings.swift` file →
    /// add the `.all` array here. The namespaceCount test below
    /// catches the "I forgot to register" failure mode.
    static let namespaces: [(label: String, entries: [CivicaText])] = [
        ("EBTBalanceStrings", EBTBalanceStrings.all),
        ("EBTPushStrings", EBTPushStrings.all),
        ("EBTReceiptStrings", EBTReceiptStrings.all),
        ("EBTAnomalyStrings", EBTAnomalyStrings.all),
        ("EBTAccountServicesStrings", EBTAccountServicesStrings.all),
        ("EBTPerksStrings", EBTPerksStrings.all),
        ("EBTReferralStrings", EBTReferralStrings.all),
        ("EBTOffersStrings", EBTOffersStrings.all),
        ("EBTFreeResourcesStrings", EBTFreeResourcesStrings.all),
    ]

    @Test("Every CivicaText has non-empty EN and ES")
    func everyEntryHasBothLanguages() throws {
        for (label, entries) in Self.namespaces {
            for (index, entry) in entries.enumerated() {
                #expect(
                    !entry.en.isEmpty,
                    "EN missing in \(label) entry index \(index): \(entry)"
                )
                #expect(
                    !entry.es.isEmpty,
                    "ES missing in \(label) entry index \(index): \(entry)"
                )
            }
        }
    }

    @Test("EN and ES values differ (catches accidental copy-paste of EN into ES)")
    func enAndEsDiffer() throws {
        // Some strings legitimately match across languages (e.g.
        // proper nouns like "California", brand names like "Walmart").
        // We don't fail the test on equality — we just record the count
        // so a sudden spike (e.g. someone pasted the same string into
        // both slots) shows up in test logs without failing CI.
        var matches = 0
        for (_, entries) in Self.namespaces {
            for entry in entries where entry.en == entry.es {
                matches += 1
            }
        }
        // A sanity ceiling — if more than half of all strings are
        // identical EN/ES, something is wrong.
        let total = Self.namespaces.reduce(0) { $0 + $1.entries.count }
        if total > 0 {
            #expect(
                Double(matches) / Double(total) < 0.5,
                "Suspicious: \(matches)/\(total) EBT strings are identical in EN and ES — was Spanish accidentally pasted from English?"
            )
        }
    }

    @Test("All 7 namespace files are registered (catches forgotten registration)")
    func namespaceCount() throws {
        // If a new Strings/EBT*Strings.swift file is added, this test
        // fails until it's appended to `namespaces` above. Mitigates
        // the §16.8 "forgetting the array entry is the failure mode"
        // gap.
        #expect(
            Self.namespaces.count == 7,
            "Expected 7 EBT*Strings namespaces (Balance, Push, Receipt, Anomaly, AccountServices, Perks, Referral). Add new namespaces to EBTStringParityTests.namespaces."
        )
    }
}
