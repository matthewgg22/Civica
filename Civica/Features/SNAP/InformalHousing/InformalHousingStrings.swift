import Foundation

// Strings for InformalHousingWizardView — English + Spanish parity.
// All user-visible copy goes here; no raw strings in the SwiftUI views.

enum InformalHousingStrings {

    // MARK: - Navigation / chrome

    static let pageTitle = CivicaText(
        "Housing Situation",
        es: "Situación de vivienda",
        zh: "住房情况",
        vi: "Tình trạng nhà ở"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消",
        vi: "Hủy"
    )

    static let backButton = CivicaText(
        "Back",
        es: "Atrás",
        zh: "返回",
        vi: "Quay lại"
    )

    static let nextButton = CivicaText(
        "Next",
        es: "Siguiente",
        zh: "下一步",
        vi: "Tiếp theo"
    )

    static let skipButton = CivicaText(
        "Skip",
        es: "Omitir",
        zh: "跳过",
        vi: "Bỏ qua"
    )

    static let submitButton = CivicaText(
        "Submit Housing Information",
        es: "Enviar información de vivienda",
        zh: "提交住房信息",
        vi: "Gửi thông tin nhà ở"
    )

    static let submittingButton = CivicaText(
        "Submitting…",
        es: "Enviando…",
        zh: "正在提交…",
        vi: "Đang gửi…"
    )

    // MARK: - Progress bar

    /// "Step 2 of 7"
    static func stepOf(_ current: Int, of total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .tagalog: return "Step \(current) of \(total)"
        case .mandarin: return "第 \(current) 步,共 \(total) 步"
        case .spanish: return "Paso \(current) de \(total)"
        case .vietnamese: return "Bước \(current) trên \(total)"
        }
    }

    // MARK: - Intro card

    static let introTitle = CivicaText(
        "Tell us about your housing",
        es: "Cuéntanos sobre tu vivienda",
        zh: "告诉我们你的住房情况",
        vi: "Hãy cho chúng tôi biết về chỗ ở của bạn"
    )

    static let introBody = CivicaText(
        "You don't have a written lease — that's OK. We'll ask a few short questions to make sure your shelter costs are counted correctly for CalFresh.",
        es: "No tienes un contrato de arrendamiento escrito — está bien. Te haremos algunas preguntas cortas para asegurarnos de que tus costos de vivienda se contabilicen correctamente para CalFresh.",
        zh: "你没有书面租约 — 没关系。我们会问几个简短的问题,确保你的住房费用在 CalFresh 中被正确计算。",
        vi: "Bạn không có hợp đồng thuê nhà bằng văn bản — không sao cả. Chúng tôi sẽ hỏi vài câu ngắn để bảo đảm chi phí chỗ ở của bạn được tính đúng cho CalFresh."
    )

    // MARK: - DV shelter safety banner

    static let dvSafetyTitle = CivicaText(
        "Your safety comes first",
        es: "Tu seguridad es lo primero",
        zh: "你的安全最重要",
        vi: "An toàn của bạn là trên hết"
    )

    static let dvSafetyBody = CivicaText(
        "We will never ask for your shelter's address or location. You are not required to provide any information that could put you at risk.",
        es: "Nunca te pediremos la dirección o ubicación de tu refugio. No estás obligada a proporcionar ninguna información que pueda ponerte en riesgo.",
        zh: "我们绝不会询问你庇护所的地址或位置。你无需提供任何可能让你处于危险中的信息。",
        vi: "Chúng tôi sẽ không bao giờ hỏi địa chỉ hay vị trí nơi trú ẩn của bạn. Bạn không bắt buộc phải cung cấp bất kỳ thông tin nào có thể khiến bạn gặp nguy hiểm."
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
        zh: "已收到住房信息。",
        vi: "Đã nhận được thông tin nhà ở."
    )

    static let completeSubtitle = CivicaText(
        "Here's what we'll use for your shelter deduction:",
        es: "Esto es lo que usaremos para tu deducción de vivienda:",
        zh: "以下是我们将用于计算你住房扣除额的信息:",
        vi: "Đây là những gì chúng tôi sẽ dùng cho khoản khấu trừ chỗ ở của bạn:"
    )

    static let arrangementLabel = CivicaText(
        "Arrangement",
        es: "Tipo de vivienda",
        zh: "住房类型",
        vi: "Hình thức ở"
    )

    static let homelessDeductionLabel = CivicaText(
        "Homeless shelter deduction",
        es: "Deducción por refugio para personas sin hogar",
        zh: "无家可归者庇护所扣除额",
        vi: "Khấu trừ chỗ trú ẩn cho người vô gia cư"
    )

    static let homelessDeductionEligible = CivicaText(
        "Eligible ($198.99/mo standard)",
        es: "Elegible ($198.99/mes estándar)",
        zh: "符合资格(每月 $198.99 标准)",
        vi: "Đủ điều kiện (mức chuẩn 198,99 $/tháng)"
    )

    static let homelessDeductionNotEligible = CivicaText(
        "Not applicable",
        es: "No aplica",
        zh: "不适用",
        vi: "Không áp dụng"
    )

    static let hasShelterCostLabel = CivicaText(
        "Shelter costs",
        es: "Costos de vivienda",
        zh: "住房费用",
        vi: "Chi phí chỗ ở"
    )

    static let hasShelterCostYes = CivicaText(
        "Yes — will be counted toward your deduction",
        es: "Sí — se contarán en tu deducción",
        zh: "有 — 将计入你的扣除额",
        vi: "Có — sẽ được tính vào khoản khấu trừ của bạn"
    )

    static let hasShelterCostNo = CivicaText(
        "None reported",
        es: "No reportados",
        zh: "未填报",
        vi: "Không khai báo"
    )

    static let suaLabel = CivicaText(
        "Standard Utility Allowance",
        es: "Subsidio estándar de servicios",
        zh: "标准公用事业津贴",
        vi: "Trợ cấp tiện ích tiêu chuẩn"
    )

    static let suaEligible = CivicaText(
        "Eligible",
        es: "Elegible",
        zh: "符合资格",
        vi: "Đủ điều kiện"
    )

    static let suaNotEligible = CivicaText(
        "Not eligible",
        es: "No elegible",
        zh: "不符合资格",
        vi: "Không đủ điều kiện"
    )

    static let navigatorNoteLabel = CivicaText(
        "Navigator note",
        es: "Nota para el navegador",
        zh: "导航员备注",
        vi: "Ghi chú của điều phối viên"
    )

    static let doneButton = CivicaText(
        "Done",
        es: "Listo",
        zh: "完成",
        vi: "Xong"
    )

    // MARK: - Error states

    static let submitError = CivicaText(
        "Could not submit housing information. Please try again.",
        es: "No se pudo enviar la información de vivienda. Por favor, intenta de nuevo.",
        zh: "无法提交住房信息。请再试一次。",
        vi: "Không thể gửi thông tin nhà ở. Vui lòng thử lại."
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo",
        zh: "再试一次",
        vi: "Thử lại"
    )

    // MARK: - Accessibility

    static let progressBarLabel = CivicaText(
        "Question progress",
        es: "Progreso de las preguntas",
        zh: "问题进度",
        vi: "Tiến trình câu hỏi"
    )

    static let optionSelectedHint = CivicaText(
        "Selected",
        es: "Seleccionado",
        zh: "已选择",
        vi: "Đã chọn"
    )
}
