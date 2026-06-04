import CivicaDesignSystem

// Marketplace / perks copy for the Check EBT Balance feature.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI otherwise.

enum EBTPerksStrings {
    static let eyebrow = CivicaText(
        "PERKS FOR YOU",
        es: "BENEFICIOS PARA TI",
        zh: "为你准备的优惠"
    )
    static let freeResourcesEyebrow = CivicaText(
        "FREE RESOURCES NEAR YOU",
        es: "RECURSOS GRATUITOS CERCA",
        zh: "你附近的免费资源"
    )
    static let savingsLabel = CivicaText(
        "est. savings",
        es: "ahorro estimado",
        zh: "预计省下"
    )
    static let redeemButton = CivicaText(
        "I used this",
        es: "Lo usé",
        zh: "我用过了"
    )
    static let redeemConfirmTitle = CivicaText(
        "How much did you save?",
        es: "¿Cuánto ahorraste?",
        zh: "你省了多少?"
    )
    static let redeemConfirmBody = CivicaText(
        "We'll add it to your Saved by Civica total.",
        es: "Lo añadiremos a tu total Ahorrado con Civica.",
        zh: "我们会把它加到你的 Civica 累计省钱总额里。"
    )

    /// Confirm-sheet primary button. Custom-dollars path.
    static let redeemConfirmSaveButton = CivicaText("Save", es: "Guardar", zh: "保存")

    /// Confirm-sheet cancel toolbar item.
    static let redeemConfirmCancelButton = CivicaText("Cancel", es: "Cancelar", zh: "取消")

    /// "~$X est. savings" callout rendered on each offer row. Routed
    /// through a function so the parity guard sees a CivicaText-backed
    /// surface, not a raw `Text("~$\(…) \(…)")` literal (the checker's
    /// nested-paren stripper misses the inner `.value(in:)` call).
    /// Currency notation (`~$X`) is universal across languages; only
    /// the savingsLabel suffix translates.
    static func savingsCallout(cents: Int, language: CivicaLanguage) -> String {
        "~$\(cents / 100) \(savingsLabel.value(in: language))"
    }

    /// Curated list of every CivicaText in this namespace.
    static let all: [CivicaText] = [
        eyebrow, freeResourcesEyebrow, savingsLabel,
        redeemButton, redeemConfirmTitle, redeemConfirmBody,
        redeemConfirmSaveButton, redeemConfirmCancelButton,
    ]
}
