import Foundation

// Strings for InformalHousingWizardView — English + Spanish parity.
// All user-visible copy goes here; no raw strings in the SwiftUI views.

enum InformalHousingStrings {

    // MARK: - Navigation / chrome

    static let pageTitle = CivicaText(
        "Housing Situation",
        es: "Situación de vivienda",
        zh: "住房情况",
        vi: "Tình trạng nhà ở",
        tl: "Sitwasyon sa Tirahan"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消",
        vi: "Hủy",
        tl: "Kanselahin"
    )

    static let backButton = CivicaText(
        "Back",
        es: "Atrás",
        zh: "返回",
        vi: "Quay lại",
        tl: "Balik"
    )

    static let nextButton = CivicaText(
        "Next",
        es: "Siguiente",
        zh: "下一步",
        vi: "Tiếp theo",
        tl: "Susunod"
    )

    static let skipButton = CivicaText(
        "Skip",
        es: "Omitir",
        zh: "跳过",
        vi: "Bỏ qua",
        tl: "Laktawan"
    )

    static let submitButton = CivicaText(
        "Submit Housing Information",
        es: "Enviar información de vivienda",
        zh: "提交住房信息",
        vi: "Gửi thông tin nhà ở",
        tl: "Isumite ang Impormasyon sa Tirahan"
    )

    static let submittingButton = CivicaText(
        "Submitting…",
        es: "Enviando…",
        zh: "正在提交…",
        vi: "Đang gửi…",
        tl: "Isinusumite…"
    )

    // MARK: - Progress bar

    /// "Step 2 of 7"
    static func stepOf(_ current: Int, of total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Step \(current) of \(total)"
        case .mandarin: return "第 \(current) 步,共 \(total) 步"
        case .spanish: return "Paso \(current) de \(total)"
        case .vietnamese: return "Bước \(current) trong \(total)"
        case .tagalog: return "Hakbang \(current) ng \(total)"
        }
    }

    // MARK: - Intro card

    static let introTitle = CivicaText(
        "Tell us about your housing",
        es: "Cuéntanos sobre tu vivienda",
        zh: "告诉我们你的住房情况",
        vi: "Cho chúng tôi biết về nhà ở của bạn",
        tl: "Sabihin mo sa amin ang tungkol sa iyong tirahan"
    )

    static let introBody = CivicaText(
        "You don't have a written lease — that's OK. We'll ask a few short questions to make sure your shelter costs are counted correctly for CalFresh.",
        es: "No tienes un contrato de arrendamiento escrito — está bien. Te haremos algunas preguntas cortas para asegurarnos de que tus costos de vivienda se contabilicen correctamente para CalFresh.",
        zh: "你没有书面租约 — 没关系。我们会问几个简短的问题,确保你的住房费用在 CalFresh 中被正确计算。",
        vi: "Bạn không có hợp đồng thuê nhà bằng văn bản — không sao cả. Chúng tôi sẽ hỏi vài câu hỏi ngắn để bảo đảm chi phí nhà ở của bạn được tính đúng cho CalFresh.",
        tl: "Wala kang nakasulat na lease — okay lang iyon. Magtatanong kami ng ilang maiikling tanong para masiguro na tama ang pagbilang ng iyong gastos sa tirahan para sa CalFresh."
    )

    // MARK: - DV shelter safety banner

    static let dvSafetyTitle = CivicaText(
        "Your safety comes first",
        es: "Tu seguridad es lo primero",
        zh: "你的安全最重要",
        vi: "An toàn của bạn là trên hết",
        tl: "Ang iyong kaligtasan ang nauuna"
    )

    static let dvSafetyBody = CivicaText(
        "We will never ask for your shelter's address or location. You are not required to provide any information that could put you at risk.",
        es: "Nunca te pediremos la dirección o ubicación de tu refugio. No estás obligada a proporcionar ninguna información que pueda ponerte en riesgo.",
        zh: "我们绝不会询问你庇护所的地址或位置。你无需提供任何可能让你处于危险中的信息。",
        vi: "Chúng tôi sẽ không bao giờ hỏi địa chỉ hay vị trí nơi tạm trú của bạn. Bạn không bắt buộc phải cung cấp bất kỳ thông tin nào có thể khiến bạn gặp nguy hiểm.",
        tl: "Hindi namin kailanman hihingin ang address o lokasyon ng iyong shelter. Hindi mo kailangang magbigay ng anumang impormasyon na maaaring maglagay sa iyo sa panganib."
    )

    // MARK: - Currency field

    static let dollarPlaceholder = CivicaText(
        "0.00",
        es: "0.00",
        zh: "0.00",
        vi: "0.00"
    )

    // MARK: - Completion screen

    static let completeTitle = CivicaText(
        "Housing information received.",
        es: "Información de vivienda recibida.",
        zh: "已收到住房信息。",
        vi: "Đã nhận được thông tin nhà ở.",
        tl: "Natanggap na ang impormasyon sa tirahan."
    )

    static let completeSubtitle = CivicaText(
        "Here's what we'll use for your shelter deduction:",
        es: "Esto es lo que usaremos para tu deducción de vivienda:",
        zh: "以下是我们将用于计算你住房扣除额的信息:",
        vi: "Đây là những thông tin chúng tôi sẽ dùng để khấu trừ chi phí nhà ở của bạn:",
        tl: "Ito ang gagamitin namin para sa iyong shelter deduction:"
    )

    static let arrangementLabel = CivicaText(
        "Arrangement",
        es: "Tipo de vivienda",
        zh: "住房类型",
        vi: "Hình thức ở",
        tl: "Uri ng tirahan"
    )

    static let homelessDeductionLabel = CivicaText(
        "Homeless shelter deduction",
        es: "Deducción por refugio para personas sin hogar",
        zh: "无家可归者庇护所扣除额",
        vi: "Khấu trừ nơi tạm trú cho người vô gia cư",
        tl: "Deduction para sa shelter ng walang tirahan"
    )

    static let homelessDeductionEligible = CivicaText(
        "Eligible ($198.99/mo standard)",
        es: "Elegible ($198.99/mes estándar)",
        zh: "符合资格(每月 $198.99 标准)",
        vi: "Đủ điều kiện (mức chuẩn $198.99/tháng)",
        tl: "Kwalipikado ($198.99/buwan na standard)"
    )

    static let homelessDeductionNotEligible = CivicaText(
        "Not applicable",
        es: "No aplica",
        zh: "不适用",
        vi: "Không áp dụng",
        tl: "Hindi naaangkop"
    )

    static let hasShelterCostLabel = CivicaText(
        "Shelter costs",
        es: "Costos de vivienda",
        zh: "住房费用",
        vi: "Chi phí nhà ở",
        tl: "Gastos sa tirahan"
    )

    static let hasShelterCostYes = CivicaText(
        "Yes — will be counted toward your deduction",
        es: "Sí — se contarán en tu deducción",
        zh: "有 — 将计入你的扣除额",
        vi: "Có — sẽ được tính vào khoản khấu trừ của bạn",
        tl: "Oo — ibibilang sa iyong deduction"
    )

    static let hasShelterCostNo = CivicaText(
        "None reported",
        es: "No reportados",
        zh: "未填报",
        vi: "Không khai báo",
        tl: "Walang iniulat"
    )

    static let suaLabel = CivicaText(
        "Standard Utility Allowance",
        es: "Subsidio estándar de servicios",
        zh: "标准公用事业津贴",
        vi: "Trợ cấp tiện ích tiêu chuẩn",
        tl: "Standard Utility Allowance"
    )

    static let suaEligible = CivicaText(
        "Eligible",
        es: "Elegible",
        zh: "符合资格",
        vi: "Đủ điều kiện",
        tl: "Kwalipikado"
    )

    static let suaNotEligible = CivicaText(
        "Not eligible",
        es: "No elegible",
        zh: "不符合资格",
        vi: "Không đủ điều kiện",
        tl: "Hindi kwalipikado"
    )

    static let navigatorNoteLabel = CivicaText(
        "Navigator note",
        es: "Nota para el navegador",
        zh: "导航员备注",
        vi: "Ghi chú của người hướng dẫn",
        tl: "Tala ng navigator"
    )

    static let doneButton = CivicaText(
        "Done",
        es: "Listo",
        zh: "完成",
        vi: "Xong",
        tl: "Tapos na"
    )

    // MARK: - Error states

    static let submitError = CivicaText(
        "Could not submit housing information. Please try again.",
        es: "No se pudo enviar la información de vivienda. Por favor, intenta de nuevo.",
        zh: "无法提交住房信息。请再试一次。",
        vi: "Không thể gửi thông tin nhà ở. Vui lòng thử lại.",
        tl: "Hindi naisumite ang impormasyon sa tirahan. Pakisubukan ulit."
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo",
        zh: "再试一次",
        vi: "Thử lại",
        tl: "Subukan Ulit"
    )

    // MARK: - Accessibility

    static let progressBarLabel = CivicaText(
        "Question progress",
        es: "Progreso de las preguntas",
        zh: "问题进度",
        vi: "Tiến trình câu hỏi",
        tl: "Progreso ng mga tanong"
    )

    static let optionSelectedHint = CivicaText(
        "Selected",
        es: "Seleccionado",
        zh: "已选择",
        vi: "Đã chọn",
        tl: "Napili"
    )
}
