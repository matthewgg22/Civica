import Foundation
import Testing
@testable import Civica

// Mirrors EBTStringParityTests for the re-entry surface (G2-3).
// Every CivicaText in ReEntryStrings MUST have non-empty .en and .es.
// Drift here ships an empty Spanish label silently — this guard
// catches it at test time.

@Suite("Re-entry strings have EN/ES parity")
struct ReEntryStringParityTests {
    @Test("Every CivicaText has non-empty EN and ES")
    func everyEntryHasBothLanguages() {
        for (index, entry) in ReEntryStrings.all.enumerated() {
            #expect(
                !entry.en.isEmpty,
                "EN missing in ReEntryStrings entry index \(index): \(entry)"
            )
            #expect(
                !entry.es.isEmpty,
                "ES missing in ReEntryStrings entry index \(index): \(entry)"
            )
        }
    }

    @Test("EN and ES values differ (no accidental copy-paste of EN into ES)")
    func enAndEsDiffer() {
        // For the re-entry strings specifically, every entry has materially
        // different EN vs ES copy — no proper-noun exceptions yet. If we add
        // strings where EN==ES is legitimate (brand names, place names),
        // soften this to a count-tracking assertion like EBTStringParityTests.
        for (index, entry) in ReEntryStrings.all.enumerated() {
            #expect(
                entry.en != entry.es,
                "ReEntryStrings entry \(index) has identical EN and ES: \(entry.en)"
            )
        }
    }

    @Test("Body template carries the %d days placeholder")
    func bodyTemplateHasDaysPlaceholder() {
        // The card body interpolates days_since_close via String(format:).
        // Both languages must keep the %d placeholder or the format breaks.
        #expect(ReEntryStrings.cardBodyWithDays.en.contains("%d"),
                "EN body template missing %d placeholder")
        #expect(ReEntryStrings.cardBodyWithDays.es.contains("%d"),
                "ES body template missing %d placeholder")
    }
}
