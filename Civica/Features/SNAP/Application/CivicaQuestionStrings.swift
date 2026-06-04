import Foundation

// Shared copy for CivicaQuestionScreen — the small labels (Continue,
// Skip, I'm not sure, "3 of 8") that show up on every one-question
// screen. Keyed bilingual per HANDOFF #4 Spanish parity gate.
//
// Concrete SNAP questions (household size, income, expenses, etc.)
// live in feature-scoped strings files. This file only owns the
// primitive's chrome.

enum CivicaQuestionStrings {

    static let continueLabel = CivicaText("Continue", es: "Continuar", zh: "继续", vi: "Tiếp tục", tl: "Magpatuloy")
    static let closeLabel = CivicaText("Close", es: "Cerrar", zh: "关闭", vi: "Đóng", tl: "Isara")
    static let backLabel = CivicaText("Back", es: "Atrás", zh: "返回", vi: "Quay lại", tl: "Bumalik")
    static let skipLabel = CivicaText("Skip for now", es: "Omitir por ahora", zh: "暂时跳过", vi: "Bỏ qua bây giờ", tl: "Laktawan muna")
    static let notSureLabel = CivicaText("I'm not sure", es: "No estoy seguro", zh: "我不确定", vi: "Tôi không chắc", tl: "Hindi ako sigurado")
    static let yesLabel = CivicaText("Yes", es: "Sí", zh: "是", vi: "Có", tl: "Oo")
    static let noLabel = CivicaText("No", es: "No", zh: "否", vi: "Không", tl: "Hindi")

    /// Placeholder for dollar-amount inputs. A word rather than a
    /// digit so users can tell the field is empty — the previous "0"
    /// placeholder rendered as "$ 0" and looked like a pre-entered
    /// value, hiding the fact that the field still needed input
    /// (especially since "0" is also a valid answer for an unhoused
    /// applicant's rent, a non-disabled household's medical costs,
    /// etc.).
    static let amountPlaceholder = CivicaText("Amount", es: "Cantidad", zh: "金额", vi: "Số tiền", tl: "Halaga")

    /// "3 of 8" / "3 de 8". The Spanish form mirrors the canvas mockup
    /// (lowercase "de"). Caller passes the active language explicitly
    /// — same pattern as SNAPDecisionMathStrings interpolated helpers.
    static func progressLabel(current: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(current) of \(total)"
        case .mandarin: return "第 \(current) / \(total) 题"
        case .spanish: return "\(current) de \(total)"
        case .vietnamese: return "\(current) trên \(total)"
        case .tagalog: return "\(current) ng \(total)"
        }
    }

    /// Verbose form for VoiceOver — reads as a full sentence rather
    /// than two unrelated digits separated by silence.
    static func progressAccessibilityLabel(current: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Question \(current) of \(total)"
        case .mandarin: return "第 \(current) 题,共 \(total) 题"
        case .spanish: return "Pregunta \(current) de \(total)"
        case .vietnamese: return "Câu hỏi \(current) trên \(total)"
        case .tagalog: return "Tanong \(current) ng \(total)"
        }
    }

    /// Section label for the overall progress bar — "Section 3 of 8 ·
    /// Income" / "Sección 3 de 8 · Ingresos". Omits the title separator
    /// when no title is supplied.
    static func sectionLabel(index: Int, count: Int, title: String?, language: CivicaLanguage) -> String {
        let prefix: String
        switch language {
        case .english: prefix = "Section \(index) of \(count)"
        case .mandarin: prefix = "第 \(index) / \(count) 部分"
        case .spanish: prefix = "Sección \(index) de \(count)"
        case .vietnamese: prefix = "Phần \(index) trên \(count)"
        case .tagalog: prefix = "Seksyon \(index) ng \(count)"
        }
        if let title, !title.isEmpty {
            return "\(prefix) · \(title)"
        }
        return prefix
    }

    /// Percent label for the overall progress bar — "42%". Same in
    /// both languages; rounded to the nearest whole percent so the
    /// number doesn't jitter every keystroke.
    static func percentLabel(fraction: Double, language _: CivicaLanguage) -> String {
        let pct = Int((fraction * 100).rounded())
        return "\(pct)%"
    }

    /// Verbose accessibility label for the overall progress bar.
    /// Reads as "Application progress: about 42 percent. Section 3
    /// of 8." so VoiceOver users get a complete picture instead of
    /// just hearing the percentage.
    static func overallProgressAccessibilityLabel(
        fraction: Double,
        sectionIndex: Int,
        sectionCount: Int,
        language: CivicaLanguage
    ) -> String {
        let pct = Int((fraction * 100).rounded())
        switch language {
        case .english:
            return "Application progress: about \(pct) percent. Section \(sectionIndex) of \(sectionCount)."
        case .mandarin:
            return "申请进度:约 \(pct)%。第 \(sectionIndex) / \(sectionCount) 部分。"
        case .spanish:
            return "Progreso de la solicitud: aproximadamente \(pct) por ciento. Sección \(sectionIndex) de \(sectionCount)."
        case .vietnamese:
            return "Tiến độ đơn: khoảng \(pct) phần trăm. Phần \(sectionIndex) trên \(sectionCount)."
        case .tagalog:
            return "Progreso ng aplikasyon: mga \(pct) porsiyento. Seksyon \(sectionIndex) ng \(sectionCount)."
        }
    }
}
