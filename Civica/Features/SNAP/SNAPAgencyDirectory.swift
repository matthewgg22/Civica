import Foundation

// Single source of truth for state-conditioned agency display copy.
// SNAP surfaces that name an agency, hearing office, apply portal,
// or caseworker phone-area-codes should route through here rather
// than hardcoding "DTA" / "Boston, MA" / "(617)" inline.
//
// CA is the launch state; MA is retained as a peer because the
// prior copy targeted MA and existing users may still self-select
// it. New states join by adding a case here and one to
// SNAPRulesRegistry — no other code change needed.
//
// Spanish strings live next to English so the parity bar (every
// English string ships with es) holds for the agency layer.

enum SNAPAgencyDirectory {

    /// Two-letter USPS code for the current launch state. Surfaces
    /// that need to display agency copy but don't yet have a draft
    /// state in scope fall back to this. When the launch state
    /// changes, edit this single line.
    static let launchStateCode: String = "CA"

    /// Short agency name suitable for inline mention
    /// ("If <agency> approves your application…"). Use this when
    /// the surrounding sentence cannot accommodate the full agency
    /// name without growing too long.
    static func agencyShortName(for stateCode: String?, language: CivicaLanguage) -> String {
        switch normalized(stateCode) {
        case "CA":
            return language == .english ? "CalFresh" : "CalFresh"
        case "MA":
            return language == .english ? "DTA" : "DTA"
        default:
            return language == .english
                ? "your state SNAP office"
                : "tu oficina estatal de SNAP"
        }
    }

    /// Full official agency name. Use in legal-leaning copy
    /// (appeal letter recipient block, compliance notices) where
    /// the formal name is required.
    static func agencyFullName(for stateCode: String?, language: CivicaLanguage) -> String {
        switch normalized(stateCode) {
        case "CA":
            return language == .english
                ? "California Department of Social Services (CalFresh)"
                : "Departamento de Servicios Sociales de California (CalFresh)"
        case "MA":
            return language == .english
                ? "Massachusetts Department of Transitional Assistance"
                : "Departamento de Asistencia Transicional de Massachusetts"
        default:
            return language == .english
                ? "your state SNAP agency"
                : "tu agencia estatal de SNAP"
        }
    }

    /// Hearing-office mailing address as 4 lines (agency / division /
    /// street / city-state-zip). Used by the appeal-letter PDF
    /// recipient block.
    static func hearingOfficeLines(for stateCode: String?, language: CivicaLanguage) -> [String] {
        switch normalized(stateCode) {
        case "CA":
            return language == .english
                ? [
                    "California Department of Social Services",
                    "State Hearings Division",
                    "744 P Street, MS 19-37",
                    "Sacramento, CA 95814"
                ]
                : [
                    "Departamento de Servicios Sociales de California",
                    "División de Audiencias del Estado",
                    "744 P Street, MS 19-37",
                    "Sacramento, CA 95814"
                ]
        case "MA":
            return language == .english
                ? [
                    "Massachusetts Department of Transitional Assistance",
                    "Hearing Office",
                    "600 Washington Street",
                    "Boston, MA 02111"
                ]
                : [
                    "Departamento de Asistencia Transicional de Massachusetts",
                    "Oficina de Audiencias",
                    "600 Washington Street",
                    "Boston, MA 02111"
                ]
        default:
            return language == .english
                ? ["Your state SNAP hearing office"]
                : ["La oficina estatal de audiencias de SNAP"]
        }
    }

    /// Hearing-office address rendered as a single inline phrase
    /// ("the State Hearings Division at 744 P Street, MS 19-37,
    /// Sacramento, CA 95814"). Used in body paragraphs where a
    /// multi-line address would break the sentence.
    static func hearingOfficeInlineAddress(for stateCode: String?, language: CivicaLanguage) -> String {
        switch normalized(stateCode) {
        case "CA":
            return language == .english
                ? "the State Hearings Division at 744 P Street, MS 19-37, Sacramento, CA 95814"
                : "la División de Audiencias del Estado en 744 P Street, MS 19-37, Sacramento, CA 95814"
        case "MA":
            return language == .english
                ? "the DTA Hearing Office at 600 Washington Street, Boston, MA 02111"
                : "la Oficina de Audiencias del DTA en 600 Washington Street, Boston, MA 02111"
        default:
            return language == .english
                ? "your state SNAP hearing office"
                : "tu oficina estatal de audiencias de SNAP"
        }
    }

    /// Brand name of the state apply-online portal. CA uses
    /// "BenefitsCal"; MA uses "DTA Connect".
    static func portalName(for stateCode: String?) -> String {
        switch normalized(stateCode) {
        case "CA": return "BenefitsCal"
        case "MA": return "DTA Connect"
        default:   return ""
        }
    }

    /// Public URL of the state apply portal, suitable for inline
    /// rendering (`(benefitscal.com)`). Returns empty string for
    /// unknown states so the surrounding parenthetical can be
    /// suppressed cleanly.
    static func portalShortURL(for stateCode: String?) -> String {
        switch normalized(stateCode) {
        case "CA": return "benefitscal.com"
        case "MA": return "dtaconnect.eohhs.mass.gov"
        default:   return ""
        }
    }

    /// Caseworker phone-number area-code prefixes the user is most
    /// likely to see on incoming calls. Rendered into "Their numbers
    /// usually start with (213) or (415)" copy in the submission
    /// timeline and interview-prep surfaces.
    static func caseworkerAreaCodes(for stateCode: String?) -> [String] {
        switch normalized(stateCode) {
        case "CA":
            // The five most populous CalFresh-serving counties.
            return ["(213)", "(415)", "(510)", "(619)", "(916)"]
        case "MA":
            return ["(617)", "(508)"]
        default:
            return []
        }
    }

    /// Human-readable list of the first two area codes
    /// ("(213) or (415)"). Returns an empty string when none are
    /// known so the surrounding sentence can be suppressed.
    static func caseworkerAreaCodesInline(for stateCode: String?, language: CivicaLanguage) -> String {
        let codes = caseworkerAreaCodes(for: stateCode)
        guard codes.count >= 2 else { return codes.first ?? "" }
        let connector = language == .english ? " or " : " o "
        return codes[0] + connector + codes[1]
    }

    private static func normalized(_ stateCode: String?) -> String {
        (stateCode ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
    }
}
