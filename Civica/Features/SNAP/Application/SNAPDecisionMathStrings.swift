import Foundation

// Strings for HANDOFF board 23: "Decision · partial · the math, exposed."
// Every visible string keyed for English + Spanish per HANDOFF #4
// Spanish parity gate.

enum SNAPDecisionMathStrings {

    // MARK: - Headers

    static let pageTitle = CivicaText(
        "Your eligibility result",
        es: "Tu resultado de elegibilidad",
        zh: "你的资格结果",
        vi: "Kết quả đủ điều kiện của bạn"
    )
    static let pageSubtitle = CivicaText(
        "Here's how we got to this number.",
        es: "Así llegamos a este número.",
        zh: "我们是这样算出这个数字的。",
        vi: "Đây là cách chúng tôi tính ra con số này."
    )
    static let sectionHowWeCalc = CivicaText(
        "How we calculated it",
        es: "Cómo lo calculamos",
        zh: "我们是怎么算的",
        vi: "Cách chúng tôi tính toán"
    )
    static let sectionSources = CivicaText(
        "Sources",
        es: "Fuentes",
        zh: "来源",
        vi: "Nguồn"
    )

    // MARK: - Line items (gross income → deductions → net → benefit)

    static let grossMonthlyIncome = CivicaText(
        "Gross monthly income",
        es: "Ingreso bruto mensual",
        zh: "每月总收入",
        vi: "Tổng thu nhập hàng tháng"
    )
    static let earnedIncomeDeduction = CivicaText(
        "Earned income deduction (20%)",
        es: "Deducción por ingresos del trabajo (20%)",
        zh: "工作收入扣除额(20%)",
        vi: "Khấu trừ thu nhập từ việc làm (20%)"
    )
    static let standardDeduction = CivicaText(
        "Standard deduction",
        es: "Deducción estándar",
        zh: "标准扣除额",
        vi: "Khấu trừ tiêu chuẩn"
    )
    static let dependentCareDeduction = CivicaText(
        "Dependent care",
        es: "Cuidado de dependientes",
        zh: "受抚养人照护",
        vi: "Chăm sóc người phụ thuộc"
    )
    static let medicalDeduction = CivicaText(
        "Medical (elderly/disabled)",
        es: "Médico (mayores/discapacidad)",
        zh: "医疗(老年人/残障人士)",
        vi: "Y tế (người cao tuổi/khuyết tật)"
    )
    static let childSupportDeduction = CivicaText(
        "Child support paid",
        es: "Manutención pagada",
        zh: "已支付的子女抚养费",
        vi: "Tiền cấp dưỡng con đã trả"
    )
    /// Thin inline section header that visually separates the
    /// income-adjustment deductions (earned income, standard,
    /// dependent care, medical) from the shelter block, which is
    /// computed differently and applied after the half-net test.
    static let shelterSectionLabel = CivicaText(
        "Shelter deduction",
        es: "Deducción por vivienda",
        zh: "住房扣除额",
        vi: "Khấu trừ chi phí nhà ở"
    )
    static let excessShelterDeduction = CivicaText(
        "Excess shelter deduction",
        es: "Deducción por exceso de vivienda",
        zh: "超额住房扣除额",
        vi: "Khấu trừ chi phí nhà ở vượt mức"
    )
    static let netMonthlyIncome = CivicaText(
        "Net monthly income",
        es: "Ingreso neto mensual",
        zh: "每月净收入",
        vi: "Thu nhập ròng hàng tháng"
    )
    static let thirtyPercentOfNet = CivicaText(
        "30% of net income",
        es: "30% del ingreso neto",
        zh: "净收入的 30%",
        vi: "30% thu nhập ròng"
    )
    static let maxAllotment = CivicaText(
        "Maximum allotment for your household",
        es: "Asignación máxima para tu hogar",
        zh: "你家庭的最高发放额",
        vi: "Mức trợ cấp tối đa cho hộ gia đình của bạn"
    )
    static let monthlyBenefit = CivicaText(
        "Your monthly benefit",
        es: "Tu beneficio mensual",
        zh: "你的每月福利金额",
        vi: "Trợ cấp hàng tháng của bạn"
    )

    // MARK: - Verdict headlines

    static let headlineEligible = CivicaText(
        "Likely eligible",
        es: "Probablemente elegible",
        zh: "很可能符合资格",
        vi: "Có khả năng đủ điều kiện"
    )
    static let headlineIneligible = CivicaText(
        "Likely not eligible",
        es: "Probablemente no elegible",
        zh: "很可能不符合资格",
        vi: "Có khả năng không đủ điều kiện"
    )
    static let headlineInsufficient = CivicaText(
        "Need more information",
        es: "Necesitamos más información",
        zh: "需要更多信息",
        vi: "Cần thêm thông tin"
    )
    static let estimateDisclaimer = CivicaText(
        "This is Civica's estimate. Your state agency makes the final decision.",
        es: "Esta es la estimación de Civica. Tu agencia estatal toma la decisión final.",
        zh: "这是 Civica 的估算。最终决定由你所在的州机构作出。",
        vi: "Đây là ước tính của Civica. Cơ quan tiểu bang của bạn đưa ra quyết định cuối cùng."
    )

    // MARK: - Footnote / sources

    static let rulesVersion = CivicaText(
        "Rules version",
        es: "Versión de reglas",
        zh: "规则版本",
        vi: "Phiên bản quy tắc"
    )
    static let rulesVersionHintReveal = CivicaText(
        "Double-tap to show the technical version code.",
        es: "Toca dos veces para ver el código técnico de la versión.",
        zh: "双击可显示技术版本代码。",
        vi: "Nhấn đúp để hiển thị mã phiên bản kỹ thuật."
    )
    static let rulesVersionHintHumanize = CivicaText(
        "Double-tap to show the human-readable label.",
        es: "Toca dos veces para ver la etiqueta legible.",
        zh: "双击可显示易读的标签。",
        vi: "Nhấn đúp để hiển thị nhãn dễ đọc."
    )
    static let effectiveAsOf = CivicaText(
        "Effective as of",
        es: "Efectivo a partir de",
        zh: "生效日期",
        vi: "Có hiệu lực từ"
    )

    // MARK: - CTAs

    static let continueToPacket = CivicaText(
        "Get my application packet",
        es: "Obtener mi paquete de solicitud",
        zh: "获取我的申请材料包",
        vi: "Nhận bộ hồ sơ đăng ký của tôi"
    )
    static let backToSummary = CivicaText(
        "Back to summary",
        es: "Volver al resumen",
        zh: "返回摘要",
        vi: "Quay lại bản tóm tắt"
    )

    // MARK: - Expedited service callout
    //
}
