import Foundation
import Testing
@testable import Civica

// Locks in the {agency} / {agencyFull} / {portal} / {hotline}
// substitution contract for CivicaNotificationTemplates.render(...).
// Templates contain tokens so the same data structure can be
// rendered per-recipient at send time — these tests guarantee the
// tokens actually resolve and that no raw MA-specific phrase leaks
// through for a CA recipient.

struct CivicaNotificationTemplatesTests {

    // MARK: - Token substitution

    @Test func renderSubstitutesAgencyForCA() {
        let text = CivicaText("Submitted to {agency}.", es: "Enviado a {agency}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "CA", language: .english)
        #expect(rendered == "Submitted to CalFresh.")
    }

    @Test func renderSubstitutesAgencyFullForCA() {
        let text = CivicaText("Letter from {agencyFull}.", es: "Carta de {agencyFull}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "CA", language: .english)
        #expect(rendered == "Letter from California Department of Social Services (CalFresh).")
    }

    @Test func renderSubstitutesPortalForCA() {
        let text = CivicaText("Open {portal} to submit.", es: "Abrir {portal} para enviar.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "CA", language: .english)
        #expect(rendered == "Open BenefitsCal to submit.")
    }

    @Test func renderSubstitutesHotlineForCA() {
        let text = CivicaText("Call {hotline} to ask.", es: "Llama al {hotline}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "CA", language: .english)
        #expect(rendered == "Call 1-877-847-3663 to ask.")
    }

    @Test func renderSubstitutesAgencyForMA() {
        let text = CivicaText("Submitted to {agency}.", es: "Enviado a {agency}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "MA", language: .english)
        #expect(rendered == "Submitted to DTA.")
    }

    @Test func renderSubstitutesPortalForMA() {
        let text = CivicaText("Open {portal}.", es: "Abrir {portal}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "MA", language: .english)
        #expect(rendered == "Open DTA Connect.")
    }

    @Test func renderSubstitutesSpanishAgencyFull() {
        let text = CivicaText("{agencyFull}.", es: "{agencyFull}.")
        let renderedES = CivicaNotificationTemplates.render(text, stateCode: "CA", language: .spanish)
        #expect(renderedES == "Departamento de Servicios Sociales de California (CalFresh).")
    }

    @Test func renderUnknownStatePortalFallsBackEnglish() {
        let text = CivicaText("Open {portal}.", es: "Abrir {portal}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "NY", language: .english)
        #expect(rendered == "Open your state portal.")
    }

    @Test func renderUnknownStatePortalFallsBackSpanish() {
        let text = CivicaText("Abrir {portal}.", es: "Abrir {portal}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "NY", language: .spanish)
        #expect(rendered == "Abrir el portal estatal.")
    }

    @Test func renderNilStateCodeFallsBackToLaunchPortal() {
        let text = CivicaText("Open {portal}.", es: "Abrir {portal}.")
        // Unknown vs nil is the directory's call — agencyShortName
        // for nil routes to the generic English/Spanish fallback,
        // not to CA-specific. Document that contract.
        let rendered = CivicaNotificationTemplates.render(text, stateCode: nil, language: .english)
        #expect(rendered == "Open your state portal.")
    }

    @Test func renderLeavesUnknownPlaceholdersIntact() {
        // `{deadline}` / `{recertDate}` are server-substituted —
        // the iOS render() helper passes them through so the
        // preview surface can render bracketed "you'll see your
        // actual deadline here" copy.
        let text = CivicaText("Due by {deadline}.", es: "Antes del {deadline}.")
        let rendered = CivicaNotificationTemplates.render(text, stateCode: "CA", language: .english)
        #expect(rendered == "Due by {deadline}.")
    }

    // MARK: - Template body sweep (post-render parity)

    /// For every canonical template body, rendering with `stateCode: "CA"`
    /// must not contain the literal "Massachusetts DTA" or "Massachusetts"
    /// agency name. Catches future template edits that paste in MA copy
    /// without tokenizing it.
    @Test func everyTemplateBodyCAFreeOfMARawAgencyMention() {
        for kind in CivicaNotificationKind.allCases {
            let template = CivicaNotificationTemplates.template(for: kind)
            for stanza in template.body {
                let rendered = CivicaNotificationTemplates.render(stanza, stateCode: "CA", language: .english)
                #expect(!rendered.contains("Massachusetts"),
                        "Template \(kind.rawValue) renders MA agency name for a CA recipient: \(rendered)")
                #expect(!rendered.contains("DTA"),
                        "Template \(kind.rawValue) renders DTA shortname for a CA recipient: \(rendered)")
            }
        }
    }

    /// Parallel coverage for MA — rendering with `stateCode: "MA"` must
    /// not include "CalFresh" / "BenefitsCal" agency names.
    @Test func everyTemplateBodyMAFreeOfCARawAgencyMention() {
        for kind in CivicaNotificationKind.allCases {
            let template = CivicaNotificationTemplates.template(for: kind)
            for stanza in template.body {
                let rendered = CivicaNotificationTemplates.render(stanza, stateCode: "MA", language: .english)
                #expect(!rendered.contains("CalFresh"),
                        "Template \(kind.rawValue) renders CalFresh for an MA recipient: \(rendered)")
                #expect(!rendered.contains("BenefitsCal"),
                        "Template \(kind.rawValue) renders BenefitsCal for an MA recipient: \(rendered)")
                #expect(!rendered.contains("California"),
                        "Template \(kind.rawValue) renders California for an MA recipient: \(rendered)")
            }
        }
    }
}
