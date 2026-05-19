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
}
