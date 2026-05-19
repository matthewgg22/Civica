import Foundation

// Strings for SNAPWorkRequirementsView — English + Spanish parity
// per HANDOFF #4 gate. CivicaText wraps every user-facing literal so
// the parity gate cannot be bypassed by inline language conditionals.

enum SNAPWorkRequirementsStrings {

    static let pageTitle = CivicaText(
        "Work Requirements",
        es: "Requisitos laborales"
    )

    static let sectionHeader = CivicaText(
        "Household Members",
        es: "Miembros del hogar"
    )

    static let tribalMemberLabel = CivicaText(
        "Enrolled tribal member",
        es: "Miembro tribal inscrito"
    )

    static let qualifyingProgramLabel = CivicaText(
        "Enrolled in qualifying program",
        es: "Inscrito en programa calificado"
    )

    static let qualifyingProgramSubtitle = CivicaText(
        "SNAP E&T, drug/alcohol treatment, or community mental health",
        es: "SNAP E&T, tratamiento por drogas/alcohol, o salud mental comunitaria"
    )

    static let evaluateButton = CivicaText(
        "Evaluate",
        es: "Evaluar"
    )

    // MARK: - Evaluation result

    static let resultSubject = CivicaText(
        "Subject to work requirements",
        es: "Sujeto a requisitos laborales"
    )

    static let resultNotSubject = CivicaText(
        "Not subject to work requirements",
        es: "No sujeto a requisitos laborales"
    )

    static let resultCompliance = CivicaText(
        "Compliance",
        es: "Cumplimiento"
    )

    static let resultCitations = CivicaText(
        "Citations",
        es: "Citas reglamentarias"
    )

    static let resultExemption = CivicaText(
        "Exemption",
        es: "Exención"
    )

    // MARK: - Error

    static let evaluationErrorPrefix = CivicaText(
        "Evaluation failed",
        es: "Error en la evaluación"
    )
}
