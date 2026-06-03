import Foundation

// Strings for InformalHousingWizardView — English + Spanish parity.
// All user-visible copy goes here; no raw strings in the SwiftUI views.

enum InformalHousingStrings {

    // MARK: - Navigation / chrome

    static let pageTitle = CivicaText(
        "Housing Situation",
        es: "Situación de vivienda"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar"
    )

    static let backButton = CivicaText(
        "Back",
        es: "Atrás"
    )

    static let nextButton = CivicaText(
        "Next",
        es: "Siguiente"
    )

    static let skipButton = CivicaText(
        "Skip",
        es: "Omitir"
    )

    static let submitButton = CivicaText(
        "Submit Housing Information",
        es: "Enviar información de vivienda"
    )

    static let submittingButton = CivicaText(
        "Submitting…",
        es: "Enviando…"
    )

    // MARK: - Progress bar

    /// "Step 2 of 7"
    static func stepOf(_ current: Int, of total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Step \(current) of \(total)"
        case .spanish: return "Paso \(current) de \(total)"
        }
    }

    // MARK: - Intro card

    static let introTitle = CivicaText(
        "Tell us about your housing",
        es: "Cuéntanos sobre tu vivienda"
    )

    static let introBody = CivicaText(
        "You don't have a written lease — that's OK. We'll ask a few short questions to make sure your shelter costs are counted correctly for CalFresh.",
        es: "No tienes un contrato de arrendamiento escrito — está bien. Te haremos algunas preguntas cortas para asegurarnos de que tus costos de vivienda se contabilicen correctamente para CalFresh."
    )

    // MARK: - DV shelter safety banner

    static let dvSafetyTitle = CivicaText(
        "Your safety comes first",
        es: "Tu seguridad es lo primero"
    )

    static let dvSafetyBody = CivicaText(
        "We will never ask for your shelter's address or location. You are not required to provide any information that could put you at risk.",
        es: "Nunca te pediremos la dirección o ubicación de tu refugio. No estás obligada a proporcionar ninguna información que pueda ponerte en riesgo."
    )

    // MARK: - Currency field

    static let dollarPlaceholder = CivicaText(
        "0.00",
        es: "0.00"
    )

    // MARK: - Completion screen

    static let completeTitle = CivicaText(
        "Housing information received.",
        es: "Información de vivienda recibida."
    )

    static let completeSubtitle = CivicaText(
        "Here's what we'll use for your shelter deduction:",
        es: "Esto es lo que usaremos para tu deducción de vivienda:"
    )

    static let arrangementLabel = CivicaText(
        "Arrangement",
        es: "Tipo de vivienda"
    )

    static let homelessDeductionLabel = CivicaText(
        "Homeless shelter deduction",
        es: "Deducción por refugio para personas sin hogar"
    )

    static let homelessDeductionEligible = CivicaText(
        "Eligible ($198.99/mo standard)",
        es: "Elegible ($198.99/mes estándar)"
    )

    static let homelessDeductionNotEligible = CivicaText(
        "Not applicable",
        es: "No aplica"
    )

    static let hasShelterCostLabel = CivicaText(
        "Shelter costs",
        es: "Costos de vivienda"
    )

    static let hasShelterCostYes = CivicaText(
        "Yes — will be counted toward your deduction",
        es: "Sí — se contarán en tu deducción"
    )

    static let hasShelterCostNo = CivicaText(
        "None reported",
        es: "No reportados"
    )

    static let suaLabel = CivicaText(
        "Standard Utility Allowance",
        es: "Subsidio estándar de servicios"
    )

    static let suaEligible = CivicaText(
        "Eligible",
        es: "Elegible"
    )

    static let suaNotEligible = CivicaText(
        "Not eligible",
        es: "No elegible"
    )

    static let navigatorNoteLabel = CivicaText(
        "Navigator note",
        es: "Nota para el navegador"
    )

    static let doneButton = CivicaText(
        "Done",
        es: "Listo"
    )

    // MARK: - Error states

    static let submitError = CivicaText(
        "Could not submit housing information. Please try again.",
        es: "No se pudo enviar la información de vivienda. Por favor, intenta de nuevo."
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo"
    )

    // MARK: - Accessibility

    static let progressBarLabel = CivicaText(
        "Question progress",
        es: "Progreso de las preguntas"
    )

    static let optionSelectedHint = CivicaText(
        "Selected",
        es: "Seleccionado"
    )
}
