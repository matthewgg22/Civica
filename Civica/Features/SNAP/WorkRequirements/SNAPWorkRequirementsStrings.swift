import Foundation

// Strings for SNAPWorkRequirementsView — English + Spanish parity
// per HANDOFF #4 gate. CivicaText wraps every user-facing literal so
// the parity gate cannot be bypassed by inline language conditionals.

enum SNAPWorkRequirementsStrings {

    static let pageTitle = CivicaText(
        "Work Requirements",
        es: "Requisitos laborales",
        zh: "工作要求"
    )

    static let sectionHeader = CivicaText(
        "Household Members",
        es: "Miembros del hogar",
        zh: "家庭成员"
    )

    static let tribalMemberLabel = CivicaText(
        "Enrolled tribal member",
        es: "Miembro tribal inscrito",
        zh: "已注册的部落成员"
    )

    static let qualifyingProgramLabel = CivicaText(
        "Enrolled in qualifying program",
        es: "Inscrito en programa calificado",
        zh: "已参加符合条件的项目"
    )

    static let qualifyingProgramSubtitle = CivicaText(
        "SNAP E&T, drug/alcohol treatment, or community mental health",
        es: "SNAP E&T, tratamiento por drogas/alcohol, o salud mental comunitaria",
        zh: "SNAP E&T、戒毒/戒酒治疗,或社区心理健康项目"
    )

    static let evaluateButton = CivicaText(
        "Evaluate",
        es: "Evaluar",
        zh: "评估"
    )

    // MARK: - Evaluation result

    static let resultSubject = CivicaText(
        "Subject to work requirements",
        es: "Sujeto a requisitos laborales",
        zh: "需要遵守工作要求"
    )

    static let resultNotSubject = CivicaText(
        "Not subject to work requirements",
        es: "No sujeto a requisitos laborales",
        zh: "无需遵守工作要求"
    )

    static let resultCompliance = CivicaText(
        "Compliance",
        es: "Cumplimiento",
        zh: "合规情况"
    )

    static let resultCitations = CivicaText(
        "Citations",
        es: "Citas reglamentarias",
        zh: "法规引用"
    )

    static let resultExemption = CivicaText(
        "Exemption",
        es: "Exención",
        zh: "豁免"
    )

    // MARK: - Error

    static let evaluationErrorPrefix = CivicaText(
        "Evaluation failed",
        es: "Error en la evaluación",
        zh: "评估失败"
    )
}
