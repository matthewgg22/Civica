import Foundation

// Strings for HANDOFF board 23: "Decision · partial · the math, exposed."
// Every visible string keyed for English + Spanish per HANDOFF #4
// Spanish parity gate.

enum SNAPDecisionMathStrings {

    // MARK: - Headers

    static let pageTitle = CivicaText(
        "Your eligibility result",
        es: "Tu resultado de elegibilidad"
    )
    static let pageSubtitle = CivicaText(
        "Here's how we got to this number.",
        es: "Así llegamos a este número."
    )
    static let sectionHowWeCalc = CivicaText(
        "How we calculated it",
        es: "Cómo lo calculamos"
    )
    static let sectionSources = CivicaText(
        "Sources",
        es: "Fuentes"
    )

    // MARK: - Line items (gross income → deductions → net → benefit)

    static let grossMonthlyIncome = CivicaText(
        "Gross monthly income",
        es: "Ingreso bruto mensual"
    )
    static let earnedIncomeDeduction = CivicaText(
        "Earned income deduction (20%)",
        es: "Deducción por ingresos del trabajo (20%)"
    )
    static let standardDeduction = CivicaText(
        "Standard deduction",
        es: "Deducción estándar"
    )
    static let dependentCareDeduction = CivicaText(
        "Dependent care",
        es: "Cuidado de dependientes"
    )
    static let medicalDeduction = CivicaText(
        "Medical (elderly/disabled)",
        es: "Médico (mayores/discapacidad)"
    )
    static let childSupportDeduction = CivicaText(
        "Child support paid",
        es: "Manutención pagada"
    )
    static let excessShelterDeduction = CivicaText(
        "Excess shelter deduction",
        es: "Deducción por exceso de vivienda"
    )
    static let netMonthlyIncome = CivicaText(
        "Net monthly income",
        es: "Ingreso neto mensual"
    )
    static let thirtyPercentOfNet = CivicaText(
        "30% of net income",
        es: "30% del ingreso neto"
    )
    static let maxAllotment = CivicaText(
        "Maximum allotment for your household",
        es: "Asignación máxima para tu hogar"
    )
    static let monthlyBenefit = CivicaText(
        "Your monthly benefit",
        es: "Tu beneficio mensual"
    )

    // MARK: - Verdict headlines

    static let headlineEligible = CivicaText(
        "Likely eligible",
        es: "Probablemente elegible"
    )
    static let headlineIneligible = CivicaText(
        "Likely not eligible",
        es: "Probablemente no elegible"
    )
    static let headlineInsufficient = CivicaText(
        "Need more information",
        es: "Necesitamos más información"
    )
    static let estimateDisclaimer = CivicaText(
        "This is Civica's estimate. Your state agency makes the final decision.",
        es: "Esta es la estimación de Civica. Tu agencia estatal toma la decisión final."
    )

    // MARK: - Footnote / sources

    static let rulesVersion = CivicaText(
        "Rules version",
        es: "Versión de reglas"
    )
    static let effectiveAsOf = CivicaText(
        "Effective as of",
        es: "Efectivo a partir de"
    )

    // MARK: - CTAs

    static let continueToPacket = CivicaText(
        "Get my application packet",
        es: "Obtener mi paquete de solicitud"
    )
    static let backToSummary = CivicaText(
        "Back to summary",
        es: "Volver al resumen"
    )
}
