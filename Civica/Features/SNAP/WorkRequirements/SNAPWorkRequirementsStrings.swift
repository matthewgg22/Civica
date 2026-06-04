import Foundation

// Strings for SNAPWorkRequirementsView — English + Spanish parity
// per HANDOFF #4 gate. CivicaText wraps every user-facing literal so
// the parity gate cannot be bypassed by inline language conditionals.

enum SNAPWorkRequirementsStrings {

    static let pageTitle = CivicaText(
        "Work Requirements",
        es: "Requisitos laborales",
        zh: "工作要求",
        vi: "Yêu cầu làm việc",
        tl: "Mga Kailangan sa Trabaho"
    )

    static let sectionHeader = CivicaText(
        "Household Members",
        es: "Miembros del hogar",
        zh: "家庭成员",
        vi: "Thành viên trong hộ gia đình",
        tl: "Mga Miyembro ng Sambahayan"
    )

    static let tribalMemberLabel = CivicaText(
        "Enrolled tribal member",
        es: "Miembro tribal inscrito",
        zh: "已注册的部落成员",
        vi: "Thành viên bộ lạc đã ghi danh",
        tl: "Naka-enroll na miyembro ng tribo"
    )

    static let qualifyingProgramLabel = CivicaText(
        "Enrolled in qualifying program",
        es: "Inscrito en programa calificado",
        zh: "已参加符合条件的项目",
        vi: "Đã ghi danh vào chương trình đủ điều kiện",
        tl: "Naka-enroll sa kwalipikadong programa"
    )

    static let qualifyingProgramSubtitle = CivicaText(
        "SNAP E&T, drug/alcohol treatment, or community mental health",
        es: "SNAP E&T, tratamiento por drogas/alcohol, o salud mental comunitaria",
        zh: "SNAP E&T、戒毒/戒酒治疗,或社区心理健康项目",
        vi: "SNAP E&T, điều trị cai nghiện ma túy/rượu, hoặc sức khỏe tâm thần cộng đồng",
        tl: "SNAP E&T, paggamot sa droga/alak, o community mental health"
    )

    static let evaluateButton = CivicaText(
        "Evaluate",
        es: "Evaluar",
        zh: "评估",
        vi: "Đánh giá",
        tl: "Suriin"
    )

    // MARK: - Evaluation result

    static let resultSubject = CivicaText(
        "Subject to work requirements",
        es: "Sujeto a requisitos laborales",
        zh: "需要遵守工作要求",
        vi: "Phải tuân theo yêu cầu làm việc",
        tl: "Saklaw ng mga kailangan sa trabaho"
    )

    static let resultNotSubject = CivicaText(
        "Not subject to work requirements",
        es: "No sujeto a requisitos laborales",
        zh: "无需遵守工作要求",
        vi: "Không phải tuân theo yêu cầu làm việc",
        tl: "Hindi saklaw ng mga kailangan sa trabaho"
    )

    static let resultCompliance = CivicaText(
        "Compliance",
        es: "Cumplimiento",
        zh: "合规情况",
        vi: "Tuân thủ",
        tl: "Pagsunod"
    )

    static let resultCitations = CivicaText(
        "Citations",
        es: "Citas reglamentarias",
        zh: "法规引用",
        vi: "Trích dẫn quy định",
        tl: "Mga sanggunian sa batas"
    )

    static let resultExemption = CivicaText(
        "Exemption",
        es: "Exención",
        zh: "豁免",
        vi: "Miễn trừ",
        tl: "Eksempsyon"
    )

    // MARK: - Error

    static let evaluationErrorPrefix = CivicaText(
        "Evaluation failed",
        es: "Error en la evaluación",
        zh: "评估失败",
        vi: "Đánh giá thất bại",
        tl: "Nabigo ang pagsusuri"
    )
}
