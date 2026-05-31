import Foundation
import Testing
@testable import Civica

// Regression guard for MA-hardcoded resource pointers on the SNAP
// application surfaces (status timeline + draft-summary PDF).
//
// Bug: both surfaces hardcoded Massachusetts resources —
// "dtaconnect.eohhs.mass.gov", "DTA Connect", "DTA office",
// "MA BBCE 200%" — even though Civica's launch state is California and
// the user can select a state. They now read the apply portal, agency
// name, and BBCE-state label from SNAPAgencyDirectory (the single
// source for state-conditioned copy).
@Suite("SNAP application surfaces use state-conditioned resources, not hardcoded MA")
struct SNAPApplicationStateResourceTests {

    // MARK: - Status timeline submit detail

    @Test("CA submit step points at BenefitsCal host, not MA DTA Connect")
    func timelineSubmitDetailIsCalifornia() throws {
        for language in [CivicaLanguage.english, .spanish] {
            let steps = SNAPStatusTimelineBuilder.steps(
                for: .packetGenerated,
                milestones: [:],
                language: language,
                stateCode: "CA"
            )
            let submit = try #require(steps.first { $0.id == "submit" })
            let detail = try #require(submit.detail, "submit step should have a detail line for packetGenerated (\(language))")
            #expect(
                detail.localizedCaseInsensitiveContains("benefitscal.com"),
                "CA submit detail (\(language)) should point at benefitscal.com: \(detail)"
            )
            #expect(
                !detail.localizedCaseInsensitiveContains("mass.gov"),
                "CA submit detail (\(language)) still references a MA host: \(detail)"
            )
        }
    }

    @Test("MA submit step still resolves MA host (state-conditioning intact)")
    func timelineSubmitDetailHonorsSelectedState() throws {
        let steps = SNAPStatusTimelineBuilder.steps(
            for: .packetGenerated,
            milestones: [:],
            language: .english,
            stateCode: "MA"
        )
        let submit = try #require(steps.first { $0.id == "submit" })
        let detail = try #require(submit.detail)
        #expect(
            detail.localizedCaseInsensitiveContains("dtaconnect.eohhs.mass.gov"),
            "MA submit detail should still resolve the MA host — proves it's state-conditioned, not globally swapped: \(detail)"
        )
    }

    // MARK: - Draft summary PDF footer

    @Test("CA PDF disclosure names CalFresh / BenefitsCal, not MA DTA")
    func pdfDisclosureIsCalifornia() throws {
        for language in [CivicaLanguage.english, .spanish] {
            let disclosure = SNAPPacketPDFStrings.disclosure(stateCode: "CA", language: language)
            #expect(
                disclosure.localizedCaseInsensitiveContains("benefitscal"),
                "CA PDF disclosure (\(language)) should name BenefitsCal: \(disclosure)"
            )
            #expect(
                !disclosure.localizedCaseInsensitiveContains("mass.gov")
                    && !disclosure.localizedCaseInsensitiveContains("DTA"),
                "CA PDF disclosure (\(language)) still references MA DTA resources: \(disclosure)"
            )
        }
    }

    @Test("CA PDF rules line labels BBCE state as CA, not MA")
    func pdfRulesLineIsCalifornia() throws {
        for language in [CivicaLanguage.english, .spanish] {
            let line = SNAPPacketPDFStrings.rulesLine(stateCode: "CA", language: language)
            #expect(line.contains("CA BBCE"), "rules line (\(language)) should label CA BBCE: \(line)")
            #expect(!line.contains("MA BBCE"), "rules line (\(language)) still says MA BBCE: \(line)")
        }
    }

    @Test("PDF rules line falls back to launch state (CA) when no state captured")
    func pdfRulesLineFallsBackToLaunchState() throws {
        let line = SNAPPacketPDFStrings.rulesLine(stateCode: nil, language: .english)
        #expect(
            line.contains("\(SNAPAgencyDirectory.launchStateCode) BBCE"),
            "rules line should fall back to the launch state BBCE label: \(line)"
        )
    }
}
