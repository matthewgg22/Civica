import CivicaDesignSystem

// State-directory copy for the Check EBT Balance feature's account
// services screen. Populated by Lane C (T13) — California-specific
// phone numbers and URLs for lost/stolen card, SNAP application,
// county office finder, and fraud reporting.
//
// Numbers + URLs live in EBTAccountServicesDirectory (the data layer);
// this file only owns recipient-facing labels and headers. New state
// launches (per plan §16.6) add their own directory entries; copy
// stays state-agnostic in EN+ES.
//
// Every CivicaText MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTAccountServicesStrings {
    static let screenTitle = CivicaText(
        "Account services",
        es: "Servicios de cuenta"
    )

    static let intro = CivicaText(
        "Direct lines to the agencies that handle your EBT card. Tap to call or open the right site — no menu trees, no hold music guesswork.",
        es: "Líneas directas a las agencias que manejan tu tarjeta EBT. Toca para llamar o abrir el sitio correcto — sin menús de teléfono, sin esperas adivinando."
    )

    // MARK: - Section headers

    static let urgentSectionTitle = CivicaText(
        "Urgent",
        es: "Urgente"
    )
    static let benefitsSectionTitle = CivicaText(
        "Benefits & application",
        es: "Beneficios y solicitud"
    )
    static let reportingSectionTitle = CivicaText(
        "Report a problem",
        es: "Reportar un problema"
    )

    // MARK: - Row titles

    static let lostOrStolenCardTitle = CivicaText(
        "Lost or stolen card",
        es: "Tarjeta perdida o robada"
    )
    static let lostOrStolenCardHelp = CivicaText(
        "Call California EBT customer service. They lock your card immediately and mail a replacement.",
        es: "Llama al servicio al cliente de EBT de California. Bloquean tu tarjeta de inmediato y envían un reemplazo por correo."
    )

    static let applyForSNAPTitle = CivicaText(
        "Apply for SNAP via BenefitsCal",
        es: "Solicitar SNAP en BenefitsCal"
    )
    static let applyForSNAPHelp = CivicaText(
        "California's official benefits portal — start a new CalFresh application or check an existing one.",
        es: "El portal oficial de beneficios de California — comienza una nueva solicitud de CalFresh o revisa una existente."
    )

    static let countyOfficeFinderTitle = CivicaText(
        "Local SNAP office finder",
        es: "Buscador de oficinas locales de SNAP"
    )
    static let countyOfficeFinderHelp = CivicaText(
        "Find the CalFresh office in your county for in-person help, interviews, or document drop-off.",
        es: "Encuentra la oficina de CalFresh en tu condado para ayuda en persona, entrevistas o entrega de documentos."
    )

    static let reportFraudTitle = CivicaText(
        "Report fraud",
        es: "Reportar fraude"
    )
    static let reportFraudHelp = CivicaText(
        "Suspect someone is using your EBT card or your benefits were stolen? Report it to USDA.",
        es: "¿Sospechas que alguien está usando tu tarjeta EBT o que robaron tus beneficios? Repórtalo al USDA."
    )

    // MARK: - Accessibility labels

    /// Spoken label for a "Tap to call" action. The view interpolates
    /// the row title (e.g. "Tap to call Lost or stolen card").
    static func callActionA11y(rowTitle: String, language: CivicaLanguage) -> String {
        language == .english
            ? "Tap to call \(rowTitle)"
            : "Toca para llamar a \(rowTitle)"
    }

    /// Spoken label for "Tap to open in Safari".
    static func openLinkA11y(rowTitle: String, language: CivicaLanguage) -> String {
        language == .english
            ? "Tap to open \(rowTitle) in Safari"
            : "Toca para abrir \(rowTitle) en Safari"
    }

    // MARK: - Parity introspection (see EBTBalanceStrings.all for rationale)

    static let all: [CivicaText] = [
        screenTitle, intro,
        urgentSectionTitle, benefitsSectionTitle, reportingSectionTitle,
        lostOrStolenCardTitle, lostOrStolenCardHelp,
        applyForSNAPTitle, applyForSNAPHelp,
        countyOfficeFinderTitle, countyOfficeFinderHelp,
        reportFraudTitle, reportFraudHelp,
    ]
}
