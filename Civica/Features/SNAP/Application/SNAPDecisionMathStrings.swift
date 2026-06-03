import Foundation

// Strings for HANDOFF board 23: "Decision · partial · the math, exposed."
// Every visible string keyed for English + Spanish per HANDOFF #4
// Spanish parity gate.

enum SNAPDecisionMathStrings {

    // MARK: - Headers

    static let pageTitle = CivicaText(
        "Your eligibility result",
        es: "Tu resultado de elegibilidad",
        zh: "你的资格结果"
    )
    static let pageSubtitle = CivicaText(
        "Here's how we got to this number.",
        es: "Así llegamos a este número.",
        zh: "我们是这样算出这个数字的。"
    )
    static let sectionHowWeCalc = CivicaText(
        "How we calculated it",
        es: "Cómo lo calculamos",
        zh: "我们是怎么算的"
    )
    static let sectionSources = CivicaText(
        "Sources",
        es: "Fuentes",
        zh: "来源"
    )

    // MARK: - Line items (gross income → deductions → net → benefit)

    static let grossMonthlyIncome = CivicaText(
        "Gross monthly income",
        es: "Ingreso bruto mensual",
        zh: "每月总收入"
    )
    static let earnedIncomeDeduction = CivicaText(
        "Earned income deduction (20%)",
        es: "Deducción por ingresos del trabajo (20%)",
        zh: "工作收入扣除额(20%)"
    )
    static let standardDeduction = CivicaText(
        "Standard deduction",
        es: "Deducción estándar",
        zh: "标准扣除额"
    )
    static let dependentCareDeduction = CivicaText(
        "Dependent care",
        es: "Cuidado de dependientes",
        zh: "受抚养人照护"
    )
    static let medicalDeduction = CivicaText(
        "Medical (elderly/disabled)",
        es: "Médico (mayores/discapacidad)",
        zh: "医疗(老年人/残障人士)"
    )
    static let childSupportDeduction = CivicaText(
        "Child support paid",
        es: "Manutención pagada",
        zh: "已支付的子女抚养费"
    )
    /// Thin inline section header that visually separates the
    /// income-adjustment deductions (earned income, standard,
    /// dependent care, medical) from the shelter block, which is
    /// computed differently and applied after the half-net test.
    static let shelterSectionLabel = CivicaText(
        "Shelter deduction",
        es: "Deducción por vivienda",
        zh: "住房扣除额"
    )
    static let excessShelterDeduction = CivicaText(
        "Excess shelter deduction",
        es: "Deducción por exceso de vivienda",
        zh: "超额住房扣除额"
    )
    static let netMonthlyIncome = CivicaText(
        "Net monthly income",
        es: "Ingreso neto mensual",
        zh: "每月净收入"
    )
    static let thirtyPercentOfNet = CivicaText(
        "30% of net income",
        es: "30% del ingreso neto",
        zh: "净收入的 30%"
    )
    static let maxAllotment = CivicaText(
        "Maximum allotment for your household",
        es: "Asignación máxima para tu hogar",
        zh: "你家庭的最高发放额"
    )
    static let monthlyBenefit = CivicaText(
        "Your monthly benefit",
        es: "Tu beneficio mensual",
        zh: "你的每月福利金额"
    )

    // MARK: - Verdict headlines

    static let headlineEligible = CivicaText(
        "Likely eligible",
        es: "Probablemente elegible",
        zh: "很可能符合资格"
    )
    static let headlineIneligible = CivicaText(
        "Likely not eligible",
        es: "Probablemente no elegible",
        zh: "很可能不符合资格"
    )
    static let headlineInsufficient = CivicaText(
        "Need more information",
        es: "Necesitamos más información",
        zh: "需要更多信息"
    )
    static let estimateDisclaimer = CivicaText(
        "This is Civica's estimate. Your state agency makes the final decision.",
        es: "Esta es la estimación de Civica. Tu agencia estatal toma la decisión final.",
        zh: "这是 Civica 的估算。最终决定由你所在的州机构作出。"
    )

    // MARK: - Footnote / sources

    static let rulesVersion = CivicaText(
        "Rules version",
        es: "Versión de reglas",
        zh: "规则版本"
    )
    static let rulesVersionHintReveal = CivicaText(
        "Double-tap to show the technical version code.",
        es: "Toca dos veces para ver el código técnico de la versión.",
        zh: "双击可显示技术版本代码。"
    )
    static let rulesVersionHintHumanize = CivicaText(
        "Double-tap to show the human-readable label.",
        es: "Toca dos veces para ver la etiqueta legible.",
        zh: "双击可显示易读的标签。"
    )
    static let effectiveAsOf = CivicaText(
        "Effective as of",
        es: "Efectivo a partir de",
        zh: "生效日期"
    )

    // MARK: - CTAs

    static let continueToPacket = CivicaText(
        "Get my application packet",
        es: "Obtener mi paquete de solicitud",
        zh: "获取我的申请材料包"
    )
    static let backToSummary = CivicaText(
        "Back to summary",
        es: "Volver al resumen",
        zh: "返回摘要"
    )

    // MARK: - Expedited service callout
    //
}
