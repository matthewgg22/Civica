import Foundation
import Testing
@testable import Civica

// EN/ES parity guard for IntakeHelpStrings, the new contextual-help
// sheet copy shipping with the Monday demo (per office-hours 2026-05-29
// GSTACK REVIEW REPORT T7).
//
// Mirrors EBTStringParityTests almost line-for-line — same failure
// mode (a missing Spanish entry ships as an empty label, not a crash;
// the test catches drift at CI). Curated `.all` array on the namespace
// is the source of truth for what's enforced; adding a new string
// requires appending it to IntakeHelpStrings.all or this test fails.

@Suite("IntakeHelp strings have EN/ES parity")
struct IntakeHelpStringParityTests {

    @Test("Every CivicaText has non-empty EN and ES")
    func everyEntryHasBothLanguages() throws {
        for (index, entry) in IntakeHelpStrings.all.enumerated() {
            #expect(
                !entry.en.isEmpty,
                "EN missing in IntakeHelpStrings entry index \(index): \(entry)"
            )
            #expect(
                !entry.es.isEmpty,
                "ES missing in IntakeHelpStrings entry index \(index): \(entry)"
            )
        }
    }

    @Test("EN and ES values differ (catches accidental copy-paste of EN into ES)")
    func enAndEsDiffer() throws {
        // Some strings may legitimately share text across languages
        // (proper nouns, brand names). We don't fail on equality; we
        // assert the ratio stays sane. The intake-help copy is short
        // enough that a 50% ceiling is plenty of headroom — a real
        // copy-paste regression would cluster much higher.
        let matches = IntakeHelpStrings.all.filter { $0.en == $0.es }.count
        let total = IntakeHelpStrings.all.count
        if total > 0 {
            #expect(
                Double(matches) / Double(total) < 0.5,
                "Suspicious: \(matches)/\(total) IntakeHelp strings are identical in EN and ES — was Spanish accidentally pasted from English?"
            )
        }
    }

    @Test("errorFallback template substitutes {title} placeholder")
    func errorFallbackTemplateSubstitutes() throws {
        // Catches the failure mode where the template literal drifts
        // (e.g. someone removes "{title}" from the EN or ES copy) —
        // the helper would silently render the literal placeholder
        // into the sheet otherwise.
        let title = "How many people live in your household?"

        let en = IntakeHelpStrings.errorFallback(title: title, language: .english)
        #expect(en.contains(title), "EN error fallback didn't substitute {title}: \(en)")
        #expect(!en.contains("{title}"), "EN error fallback left {title} placeholder unreplaced: \(en)")

        let es = IntakeHelpStrings.errorFallback(title: title, language: .spanish)
        #expect(es.contains(title), "ES error fallback didn't substitute {title}: \(es)")
        #expect(!es.contains("{title}"), "ES error fallback left {title} placeholder unreplaced: \(es)")
    }
}
