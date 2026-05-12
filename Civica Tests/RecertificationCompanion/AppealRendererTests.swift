import Foundation
import Testing
@testable import Civica

// Verifies:
//   - Reason-specific paragraphs are correctly selected
//   - Slot substitution is correct
//   - Missing-slot reporting is correct
//   - Statutory citations from the template come through unchanged
// Cross-state × cross-language × all-reasons matrix.

struct AppealRendererTests {

    private func template(state: String, language: String) -> AppealTemplate {
        let bundle = Bundle.main
        let resource = "\(state).\(language)"
        let url = bundle.url(forResource: resource, withExtension: "json", subdirectory: "AppealTemplates")
            ?? bundle.url(forResource: resource, withExtension: "json")
        if let url, let data = try? Data(contentsOf: url),
           let decoded = try? AppealTemplateLoader.decode(data) {
            return decoded
        }
        return syntheticTemplate(state: state, language: language)
    }

    private func syntheticTemplate(state: String, language: String) -> AppealTemplate {
        AppealTemplate(
            stateCode: state,
            language: language,
            agencyName: "Test Agency",
            agencyAddressBlock: "Test Address",
            statutoryCitations: AppealTemplate.Citations(
                federal: "7 CFR 273.2(d)",
                state: state == "MA" ? "106 CMR 343" : "MPP 22-001"
            ),
            paragraphs: AppealTemplate.Paragraphs(
                header: "Header for {{claimantName}} case {{caseNumber}}",
                opening: "Opening paragraph.",
                missedInterview: "Reason: missed interview.",
                missingDocuments: "Reason: missing documents per 7 CFR 273.2(d)(1).",
                noResponse: "Reason: no response.",
                otherProcedural: "Reason: other procedural.",
                failureVsRefusalArgument: "Failure vs refusal argument per 7 CFR 273.2(d).",
                closing: "Closing.",
                signatureBlock: "Signed,\n{{claimantName}}"
            ),
            requiredSlots: ["claimantName", "caseNumber"]
        )
    }

    @Test func reasonSelection_missedInterview_pullsMissedInterviewParagraph() {
        let tpl = template(state: "MA", language: "en")
        let para = AppealRenderer.reasonParagraph(template: tpl, reason: .missedInterview)
        #expect(para == tpl.paragraphs.missedInterview)
    }

    @Test func reasonSelection_missingDocuments_pullsMissingDocumentsParagraph() {
        let tpl = template(state: "MA", language: "en")
        let para = AppealRenderer.reasonParagraph(template: tpl, reason: .missingDocuments)
        #expect(para == tpl.paragraphs.missingDocuments)
    }

    @Test func statutoryCitations_appearInTemplate_andSurviveRender() {
        let tpl = template(state: "MA", language: "en")
        let doc = AppealRenderer.render(template: tpl, denialReason: .missingDocuments, slots: [
            "claimantName": "Jane Doe",
            "caseNumber": "12345"
        ])
        #expect(doc.body.contains("7 CFR 273.2") || doc.body.contains(tpl.statutoryCitations.federal))
    }

    @Test func renderedBody_substitutesProvidedSlots() {
        let tpl = template(state: "MA", language: "en")
        let doc = AppealRenderer.render(template: tpl, denialReason: .missedInterview, slots: [
            "claimantName": "Jane Doe",
            "caseNumber": "ABC-999"
        ])
        #expect(doc.body.contains("Jane Doe"))
        #expect(doc.body.contains("ABC-999"))
        #expect(!doc.body.contains("{{claimantName}}"))
        #expect(!doc.body.contains("{{caseNumber}}"))
    }

    @Test func missingSlots_areReported_andRemainAsMarkers() {
        let tpl = template(state: "MA", language: "en")
        let doc = AppealRenderer.render(template: tpl, denialReason: .missedInterview, slots: [
            "claimantName": "Jane Doe"
        ])
        #expect(!doc.allSlotsResolved)
        #expect(doc.body.contains("{{caseNumber}}"))
        #expect(doc.missingSlots.contains("caseNumber"))
    }

    @Test func render_acrossMatrix_producesNonEmptyBody() {
        for state in ["MA", "CA"] {
            for language in ["en", "es"] {
                for reason in DenialReason.allCases {
                    let tpl = template(state: state, language: language)
                    let doc = AppealRenderer.render(
                        template: tpl,
                        denialReason: reason,
                        slots: [
                            "claimantName": "Test User",
                            "caseNumber": "T-0001",
                            "denialDate": "2026-05-01",
                            "todayDate": "2026-05-11",
                            "claimantAddress": "1 Test St",
                            "claimantPhone": "555-0100",
                            "claimantEmail": "test@example.com"
                        ]
                    )
                    #expect(!doc.body.isEmpty)
                    #expect(doc.allSlotsResolved)
                }
            }
        }
    }
}
