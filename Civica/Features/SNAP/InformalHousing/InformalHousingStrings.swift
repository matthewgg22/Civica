import Foundation

// Strings for InformalHousingWizardView — English + Spanish parity.
// All user-visible copy goes here; no raw strings in the SwiftUI views.

enum InformalHousingStrings {

    // MARK: - Navigation / chrome

    static let pageTitle = CivicaText(
        "Housing Situation",
        es: "Situación de vivienda",
        zh: "住房情况"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消"
    )

    static let backButton = CivicaText(
        "Back",
        es: "Atrás",
        zh: "返回"
    )

    static let nextButton = CivicaText(
        "Next",
        es: "Siguiente",
        zh: "下一步"
    )

    static let skipButton = CivicaText(
        "Skip",
        es: "Omitir",
        zh: "跳过"
    )

    static let submitButton = CivicaText(
        "Submit Housing Information",
        es: "Enviar información de vivienda",
        zh: "提交住房信息"
    )

    static let submittingButton = CivicaText(
        "Submitting…",
        es: "Enviando…",
        zh: "正在提交…"
    )

    // MARK: - Progress bar

    /// "Step 2 of 7"
    static func stepOf(_ current: Int, of total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Step \(current) of \(total)"
        case .mandarin: return "第 \(current) 步,共 \(total) 步"
        case .spanish: return "Paso \(current) de \(total)"
        }
    }

    // MARK: - Intro card

    static let introTitle = CivicaText(
        "Tell us about your housing",
        es: "Cuéntanos sobre tu vivienda",
        zh: "告诉我们你的住房情况"
    )

    static let introBody = CivicaText(
        "You don't have a written lease — that's OK. We'll ask a few short questions to make sure your shelter costs are counted correctly for CalFresh.",
        es: "No tienes un contrato de arrendamiento escrito — está bien. Te haremos algunas preguntas cortas para asegurarnos de que tus costos de vivienda se contabilicen correctamente para CalFresh.",
        zh: "你没有书面租约 — 没关系。我们会问几个简短的问题,确保你的住房费用在 CalFresh 中被正确计算。"
    )

    // MARK: - DV shelter safety banner

    static let dvSafetyTitle = CivicaText(
        "Your safety comes first",
        es: "Tu seguridad es lo primero",
        zh: "你的安全最重要"
    )

    static let dvSafetyBody = CivicaText(
        "We will never ask for your shelter's address or location. You are not required to provide any information that could put you at risk.",
        es: "Nunca te pediremos la dirección o ubicación de tu refugio. No estás obligada a proporcionar ninguna información que pueda ponerte en riesgo.",
        zh: "我们绝不会询问你庇护所的地址或位置。你无需提供任何可能让你处于危险中的信息。"
    )

    // MARK: - Currency field

    static let dollarPlaceholder = CivicaText(
        "0.00",
        es: "0.00",
        zh: "0.00"
    )

    // MARK: - Completion screen

    static let completeTitle = CivicaText(
        "Housing information received.",
        es: "Información de vivienda recibida.",
        zh: "已收到住房信息。"
    )

    static let completeSubtitle = CivicaText(
        "Here's what we'll use for your shelter deduction:",
        es: "Esto es lo que usaremos para tu deducción de vivienda:",
        zh: "以下是我们将用于计算你住房扣除额的信息:"
    )

    static let arrangementLabel = CivicaText(
        "Arrangement",
        es: "Tipo de vivienda",
        zh: "住房类型"
    )

    static let homelessDeductionLabel = CivicaText(
        "Homeless shelter deduction",
        es: "Deducción por refugio para personas sin hogar",
        zh: "无家可归者庇护所扣除额"
    )

    static let homelessDeductionEligible = CivicaText(
        "Eligible ($198.99/mo standard)",
        es: "Elegible ($198.99/mes estándar)",
        zh: "符合资格(每月 $198.99 标准)"
    )

    static let homelessDeductionNotEligible = CivicaText(
        "Not applicable",
        es: "No aplica",
        zh: "不适用"
    )

    static let hasShelterCostLabel = CivicaText(
        "Shelter costs",
        es: "Costos de vivienda",
        zh: "住房费用"
    )

    static let hasShelterCostYes = CivicaText(
        "Yes — will be counted toward your deduction",
        es: "Sí — se contarán en tu deducción",
        zh: "有 — 将计入你的扣除额"
    )

    static let hasShelterCostNo = CivicaText(
        "None reported",
        es: "No reportados",
        zh: "未填报"
    )

    static let suaLabel = CivicaText(
        "Standard Utility Allowance",
        es: "Subsidio estándar de servicios",
        zh: "标准公用事业津贴"
    )

    static let suaEligible = CivicaText(
        "Eligible",
        es: "Elegible",
        zh: "符合资格"
    )

    static let suaNotEligible = CivicaText(
        "Not eligible",
        es: "No elegible",
        zh: "不符合资格"
    )

    static let navigatorNoteLabel = CivicaText(
        "Navigator note",
        es: "Nota para el navegador",
        zh: "导航员备注"
    )

    static let doneButton = CivicaText(
        "Done",
        es: "Listo",
        zh: "完成"
    )

    // MARK: - Error states

    static let submitError = CivicaText(
        "Could not submit housing information. Please try again.",
        es: "No se pudo enviar la información de vivienda. Por favor, intenta de nuevo.",
        zh: "无法提交住房信息。请再试一次。"
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo",
        zh: "再试一次"
    )

    // MARK: - Accessibility

    static let progressBarLabel = CivicaText(
        "Question progress",
        es: "Progreso de las preguntas",
        zh: "问题进度"
    )

    static let optionSelectedHint = CivicaText(
        "Selected",
        es: "Seleccionado",
        zh: "已选择"
    )
}
