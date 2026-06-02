import Foundation
import Testing
@testable import Civica

// Locks in the state-conditioned display-copy contract for the
// SNAP launch-state work. CA is the launch state; MA is a peer.
// Unknown / nil state codes must fall through to a generic
// "your state SNAP …" phrasing in both English and Spanish.
//
// When the launch state changes (`SNAPAgencyDirectory.launchStateCode`),
// the `unknownStateFallsBackToLaunchStateLanguage` test catches the
// drift — flip the expected string deliberately, don't paper over.

struct SNAPAgencyDirectoryTests {

    // MARK: - launchStateCode

    @Test func launchStateCodeIsCA() {
        #expect(SNAPAgencyDirectory.launchStateCode == "CA")
    }

    // MARK: - agencyShortName

    @Test func agencyShortNameCA() {
        #expect(SNAPAgencyDirectory.agencyShortName(for: "CA", language: .english) == "CalFresh")
        #expect(SNAPAgencyDirectory.agencyShortName(for: "CA", language: .spanish) == "CalFresh")
    }

    @Test func agencyShortNameMA() {
        #expect(SNAPAgencyDirectory.agencyShortName(for: "MA", language: .english) == "DTA")
        #expect(SNAPAgencyDirectory.agencyShortName(for: "MA", language: .spanish) == "DTA")
    }

    @Test func agencyShortNameNormalizesCasing() {
        #expect(SNAPAgencyDirectory.agencyShortName(for: "ca", language: .english) == "CalFresh")
        #expect(SNAPAgencyDirectory.agencyShortName(for: " Ma ", language: .english) == "DTA")
    }

    @Test func agencyShortNameUnknownFallsBackEnglish() {
        #expect(SNAPAgencyDirectory.agencyShortName(for: "NY", language: .english) == "your state SNAP office")
    }

    @Test func agencyShortNameUnknownFallsBackSpanish() {
        #expect(SNAPAgencyDirectory.agencyShortName(for: "NY", language: .spanish) == "tu oficina estatal de SNAP")
    }

    @Test func agencyShortNameNilFallsBack() {
        #expect(SNAPAgencyDirectory.agencyShortName(for: nil, language: .english) == "your state SNAP office")
    }

    // MARK: - agencyFullName

    @Test func agencyFullNameCAEnglish() {
        let value = SNAPAgencyDirectory.agencyFullName(for: "CA", language: .english)
        #expect(value == "California Department of Social Services (CalFresh)")
    }

    @Test func agencyFullNameCASpanish() {
        let value = SNAPAgencyDirectory.agencyFullName(for: "CA", language: .spanish)
        #expect(value == "Departamento de Servicios Sociales de California (CalFresh)")
    }

    @Test func agencyFullNameMAEnglish() {
        let value = SNAPAgencyDirectory.agencyFullName(for: "MA", language: .english)
        #expect(value == "Massachusetts Department of Transitional Assistance")
    }

    @Test func agencyFullNameMASpanish() {
        let value = SNAPAgencyDirectory.agencyFullName(for: "MA", language: .spanish)
        #expect(value == "Departamento de Asistencia Transicional de Massachusetts")
    }

    // MARK: - hearingOfficeLines

    @Test func hearingOfficeLinesCAIncludesSacramentoStateHearingsDivision() {
        let lines = SNAPAgencyDirectory.hearingOfficeLines(for: "CA", language: .english)
        #expect(lines.contains("California Department of Social Services"))
        #expect(lines.contains("State Hearings Division"))
        #expect(lines.contains("PO Box 944243, MS 21-37"))
        #expect(lines.contains("Sacramento, CA 94244-2430"))
    }

    @Test func hearingOfficeLinesMAIncludesBostonHearingOffice() {
        let lines = SNAPAgencyDirectory.hearingOfficeLines(for: "MA", language: .english)
        #expect(lines.contains("Massachusetts Department of Transitional Assistance"))
        #expect(lines.contains("Hearing Office"))
        #expect(lines.contains("600 Washington Street"))
        #expect(lines.contains("Boston, MA 02111"))
    }

    @Test func hearingOfficeLinesCASpanishLocalizesAgencyAndDivision() {
        let lines = SNAPAgencyDirectory.hearingOfficeLines(for: "CA", language: .spanish)
        #expect(lines.contains("Departamento de Servicios Sociales de California"))
        #expect(lines.contains("División de Audiencias del Estado"))
        // PO Box + city/state/zip don't translate.
        #expect(lines.contains("PO Box 944243, MS 21-37"))
        #expect(lines.contains("Sacramento, CA 94244-2430"))
    }

    // MARK: - hearingOfficeInlineAddress

    @Test func hearingOfficeInlineAddressCAEnglish() {
        let value = SNAPAgencyDirectory.hearingOfficeInlineAddress(for: "CA", language: .english)
        #expect(value.contains("State Hearings Division"))
        #expect(value.contains("PO Box 944243, MS 21-37"))
        #expect(value.contains("Sacramento, CA 94244-2430"))
    }

    @Test func hearingOfficeInlineAddressMAEnglish() {
        let value = SNAPAgencyDirectory.hearingOfficeInlineAddress(for: "MA", language: .english)
        #expect(value.contains("DTA Hearing Office"))
        #expect(value.contains("Boston, MA 02111"))
    }

    // MARK: - portalName / portalShortURL

    @Test func portalNameCA() {
        #expect(SNAPAgencyDirectory.portalName(for: "CA") == "BenefitsCal")
    }

    @Test func portalNameMA() {
        #expect(SNAPAgencyDirectory.portalName(for: "MA") == "DTA Connect")
    }

    @Test func portalNameUnknownReturnsEmpty() {
        // Returns empty so the surrounding parenthetical can be
        // suppressed cleanly rather than rendering "(your state's
        // portal)".
        #expect(SNAPAgencyDirectory.portalName(for: "NY") == "")
        #expect(SNAPAgencyDirectory.portalName(for: nil) == "")
    }

    @Test func portalShortURLCA() {
        #expect(SNAPAgencyDirectory.portalShortURL(for: "CA") == "benefitscal.com")
    }

    @Test func portalShortURLMA() {
        #expect(SNAPAgencyDirectory.portalShortURL(for: "MA") == "dtaconnect.eohhs.mass.gov")
    }

    // MARK: - helplineNumber

    @Test func helplineNumberCAIsCalFreshInfoLine() {
        #expect(SNAPAgencyDirectory.helplineNumber(for: "CA") == "1-877-847-3663")
    }

    @Test func helplineNumberMAIsDTAAssistanceLine() {
        #expect(SNAPAgencyDirectory.helplineNumber(for: "MA") == "1-877-382-2363")
    }

    @Test func helplineNumberUnknownFallsBackToUSDA() {
        let value = SNAPAgencyDirectory.helplineNumber(for: "NY")
        #expect(value.contains("1-866-348-6479"))
    }

    // MARK: - caseworkerAreaCodes / inline

    @Test func caseworkerAreaCodesCAIncludesMajorMetros() {
        let codes = SNAPAgencyDirectory.caseworkerAreaCodes(for: "CA")
        #expect(codes.contains("(213)"))
        #expect(codes.contains("(415)"))
    }

    @Test func caseworkerAreaCodesMACoversProjectBreadCatchment() {
        // MA list must cover Boston (617), Springfield/Western MA (413),
        // Worcester (508) — the three regions Project Bread serves.
        let codes = SNAPAgencyDirectory.caseworkerAreaCodes(for: "MA")
        #expect(codes.contains("(617)"))
        #expect(codes.contains("(413)"))
        #expect(codes.contains("(508)"))
    }

    @Test func caseworkerAreaCodesUnknownIsEmpty() {
        #expect(SNAPAgencyDirectory.caseworkerAreaCodes(for: "NY").isEmpty)
    }

    @Test func caseworkerAreaCodesInlineEnglishUsesOr() {
        // Inline renders codes[0] + " or " + codes[1] — the Boston +
        // Springfield pair brackets MA's bimodal geography.
        let value = SNAPAgencyDirectory.caseworkerAreaCodesInline(for: "MA", language: .english)
        #expect(value == "(617) or (413)")
    }

    @Test func caseworkerAreaCodesInlineSpanishUsesO() {
        let value = SNAPAgencyDirectory.caseworkerAreaCodesInline(for: "MA", language: .spanish)
        #expect(value == "(617) o (413)")
    }

    @Test func caseworkerAreaCodesInlineUnknownIsEmpty() {
        #expect(SNAPAgencyDirectory.caseworkerAreaCodesInline(for: "NY", language: .english) == "")
    }

    // MARK: - produceMatchProgram

    @Test func produceMatchProgramCAIsMarketMatch() {
        let program = SNAPAgencyDirectory.produceMatchProgram(for: "CA")
        #expect(program?.name == "Market Match")
    }

    @Test func produceMatchProgramMAIsHIP() {
        let program = SNAPAgencyDirectory.produceMatchProgram(for: "MA")
        #expect(program?.name == "HIP")
    }

    @Test func produceMatchProgramUnknownIsNil() {
        #expect(SNAPAgencyDirectory.produceMatchProgram(for: "NY") == nil)
        #expect(SNAPAgencyDirectory.produceMatchProgram(for: nil) == nil)
    }

    @Test func produceMatchDescriptionCAEnglishLeadsWithMarketMatch() {
        let value = SNAPAgencyDirectory.produceMatchDescription(for: "CA", language: .english)
        #expect(value?.hasPrefix("Market Match:") == true)
        #expect(value?.contains("CalFresh") == true)
    }

    @Test func produceMatchDescriptionCASpanishMentionsMarketMatch() {
        let value = SNAPAgencyDirectory.produceMatchDescription(for: "CA", language: .spanish)
        #expect(value?.contains("Market Match") == true)
        #expect(value?.contains("CalFresh") == true)
    }

    @Test func produceMatchDescriptionMAEnglishLeadsWithHIP() {
        let value = SNAPAgencyDirectory.produceMatchDescription(for: "MA", language: .english)
        #expect(value?.hasPrefix("HIP:") == true)
    }

    @Test func produceMatchDescriptionUnknownIsNil() {
        #expect(SNAPAgencyDirectory.produceMatchDescription(for: "NY", language: .english) == nil)
    }

    // MARK: - Launch-state drift guard

    /// If the launch state ever flips and an entry point doesn't have
    /// a draft state in scope, the fallback renders launch-state copy.
    /// This test pins the relationship so the launch-state flip stays
    /// a single-line change in SNAPAgencyDirectory.launchStateCode
    /// rather than a hunt across surfaces.
    @Test func unknownStateFallsBackToLaunchStateLanguageWhenSurfaceUsesNilThenLaunch() {
        // The directory itself returns the generic fallback for
        // unknown codes — surfaces that want "launch-state when
        // nil" semantics route through `?? SNAPAgencyDirectory.launchStateCode`.
        // This test documents that contract.
        let launchAgency = SNAPAgencyDirectory.agencyShortName(
            for: SNAPAgencyDirectory.launchStateCode,
            language: .english
        )
        #expect(launchAgency == "CalFresh")
    }
}
