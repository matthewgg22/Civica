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
            // PO Box mailing address per CDSS State Hearings Division
            // contact page — required for appeal-letter delivery.
            // The 744 P Street physical location is not the contact
            // address for hearings correspondence.
            return language == .english
                ? [
                    "California Department of Social Services",
                    "State Hearings Division",
                    "PO Box 944243, MS 21-37",
                    "Sacramento, CA 94244-2430"
                ]
                : [
                    "Departamento de Servicios Sociales de California",
                    "División de Audiencias del Estado",
                    "PO Box 944243, MS 21-37",
                    "Sacramento, CA 94244-2430"
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
    /// ("the State Hearings Division at PO Box 944243, MS 21-37,
    /// Sacramento, CA 94244-2430"). Used in body paragraphs where a
    /// multi-line address would break the sentence.
    static func hearingOfficeInlineAddress(for stateCode: String?, language: CivicaLanguage) -> String {
        switch normalized(stateCode) {
        case "CA":
            return language == .english
                ? "the State Hearings Division at PO Box 944243, MS 21-37, Sacramento, CA 94244-2430"
                : "la División de Audiencias del Estado en PO Box 944243, MS 21-37, Sacramento, CA 94244-2430"
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

    /// Statewide CalFresh / DTA / SNAP helpline number for the
    /// state, formatted for inline rendering (e.g. "1-877-847-3663").
    /// Falls back to USDA's national SNAP Hunger Hotline when the
    /// state isn't tuned. Sourced from the same FNS State Directory
    /// snapshot the `usda_snap_state_directory.json` fixture uses.
    static func helplineNumber(for stateCode: String?) -> String {
        switch normalized(stateCode) {
        case "CA": return "1-877-847-3663"
        case "MA": return "1-877-382-2363"
        default:   return "1-866-3-HUNGRY (1-866-348-6479)"
        }
    }

    /// Whether the state operates a SNAP-EBT produce-doubling
    /// program at participating farmers markets and small grocers.
    /// CA has Market Match (CA Department of Food and Agriculture
    /// + Ecology Center). MA has HIP (Healthy Incentives Program,
    /// DTA + state legislature). Both effectively double SNAP-EBT
    /// spending on fresh produce up to a monthly cap; the program
    /// name differs and copy should reflect that.
    struct ProduceMatchProgram: Equatable {
        /// Short brand name surfaced inline — "Market Match",
        /// "HIP". Localizable display names live in
        /// `produceMatchDisplayName(for:language:)`.
        let name: String
        /// One-line description for callouts on the verdict /
        /// FindHelp surfaces. English-only; the Spanish parallel
        /// goes through `produceMatchDescription(for:language:)`.
        let englishTagline: String
    }

    /// State's produce-match program metadata, or nil when the
    /// state does not operate one Civica is tuned for. CA + MA
    /// have meaningful programs today; others fall through.
    static func produceMatchProgram(for stateCode: String?) -> ProduceMatchProgram? {
        switch normalized(stateCode) {
        case "CA":
            return ProduceMatchProgram(
                name: "Market Match",
                englishTagline: "Doubles your CalFresh dollars on fresh fruits and vegetables at participating farmers markets — up to a monthly match cap that varies by market."
            )
        case "MA":
            return ProduceMatchProgram(
                name: "HIP",
                englishTagline: "Massachusetts's Healthy Incentives Program adds money back to your EBT card for every dollar you spend on fresh fruits and vegetables at participating HIP retailers — up to a household monthly cap."
            )
        default:
            return nil
        }
    }

    /// Localized one-line description for the state's produce-match
    /// program. Falls back to nil when the state does not operate
    /// one — caller should suppress the callout entirely in that
    /// case rather than rendering a stub sentence.
    static func produceMatchDescription(for stateCode: String?, language: CivicaLanguage) -> String? {
        guard let program = produceMatchProgram(for: stateCode) else { return nil }
        switch (normalized(stateCode), language) {
        case ("CA", .english):
            return "\(program.name): \(program.englishTagline)"
        case ("CA", .spanish):
            return "Market Match: Duplica tus dólares de CalFresh en frutas y verduras frescas en los mercados de agricultores participantes — hasta un tope mensual que varía por mercado."
        case ("MA", .english):
            return "\(program.name): \(program.englishTagline)"
        case ("MA", .spanish):
            return "HIP (Programa de Incentivos Saludables) de Massachusetts agrega dinero a tu tarjeta EBT por cada dólar gastado en frutas y verduras frescas en minoristas HIP participantes — hasta un tope mensual del hogar."
        default:
            return nil
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
