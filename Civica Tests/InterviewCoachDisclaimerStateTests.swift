import Foundation
import Testing
@testable import Civica

// Regression guard for the Interview Coach legal disclaimer copy.
//
// Bug: the disclaimer (disclaimerBody) and the practice-scenario
// subtitle pointed at Massachusetts resources — mass.gov/dta,
// masslegalhelp.org, "Massachusetts initial-application scenario" —
// even though Civica's launch state is California. MA links shown to
// CA applicants is a CA-launch correctness bug, not cosmetic: it sends
// people to the wrong agency for binding answers about their case.
//
// These tests pin the disclaimer to CA resources (CalFresh / CDSS,
// 2-1-1 California, LawHelpCA) and assert no Massachusetts pointers
// survive, in BOTH languages (Spanish parity is enforced elsewhere;
// here we guard the substance, not just presence).
@Suite("Interview Coach disclaimer points at CA, not MA, resources")
struct InterviewCoachDisclaimerStateTests {

    // Massachusetts pointers that must never reappear in the disclaimer.
    private static let forbiddenMARefs = [
        "mass.gov",
        "masslegalhelp",
        "Massachusetts",
        "DTA",
    ]

    @Test("disclaimerBody contains CA resources in both languages")
    func disclaimerHasCAResources() throws {
        for language in [CivicaLanguage.english, .spanish] {
            let body = InterviewCoachStrings.disclaimerBody.value(in: language)
            #expect(
                body.localizedCaseInsensitiveContains("calfresh"),
                "Disclaimer (\(language)) should name CalFresh: \(body)"
            )
            #expect(
                body.localizedCaseInsensitiveContains("cdss.ca.gov"),
                "Disclaimer (\(language)) should point at cdss.ca.gov: \(body)"
            )
            #expect(
                body.contains("2-1-1"),
                "Disclaimer (\(language)) should point at 2-1-1 California: \(body)"
            )
            #expect(
                body.localizedCaseInsensitiveContains("lawhelpca.org"),
                "Disclaimer (\(language)) should point at a CA legal-aid resource (lawhelpca.org): \(body)"
            )
        }
    }

    @Test("disclaimerBody contains no Massachusetts pointers")
    func disclaimerHasNoMARefs() throws {
        for language in [CivicaLanguage.english, .spanish] {
            let body = InterviewCoachStrings.disclaimerBody.value(in: language)
            for ref in Self.forbiddenMARefs {
                #expect(
                    !body.localizedCaseInsensitiveContains(ref),
                    "Disclaimer (\(language)) still references MA resource '\(ref)': \(body)"
                )
            }
        }
    }

    @Test("practice scenario subtitle reflects the CA default, not MA")
    func practiceSubtitleIsCalifornia() throws {
        for language in [CivicaLanguage.english, .spanish] {
            let subtitle = InterviewCoachStrings.practiceSubtitle.value(in: language)
            #expect(
                subtitle.localizedCaseInsensitiveContains("california"),
                "Practice subtitle (\(language)) should name California: \(subtitle)"
            )
            #expect(
                !subtitle.localizedCaseInsensitiveContains("massachusetts"),
                "Practice subtitle (\(language)) still references Massachusetts: \(subtitle)"
            )
        }
    }
}
