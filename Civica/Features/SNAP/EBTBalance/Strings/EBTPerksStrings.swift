import CivicaDesignSystem

// Marketplace / perks copy for the Check EBT Balance feature.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI otherwise.

enum EBTPerksStrings {
    static let eyebrow = CivicaText(
        "PERKS FOR YOU",
        es: "BENEFICIOS PARA TI"
    )
    static let freeResourcesEyebrow = CivicaText(
        "FREE RESOURCES NEAR YOU",
        es: "RECURSOS GRATUITOS CERCA"
    )
    static let savingsLabel = CivicaText(
        "est. savings",
        es: "ahorro estimado"
    )
    static let redeemButton = CivicaText(
        "I used this",
        es: "Lo usé"
    )
    static let redeemConfirmTitle = CivicaText(
        "How much did you save?",
        es: "¿Cuánto ahorraste?"
    )
    static let redeemConfirmBody = CivicaText(
        "We'll add it to your Saved by Civica total.",
        es: "Lo añadiremos a tu total Ahorrado con Civica."
    )

    /// Curated list of every CivicaText in this namespace.
    static let all: [CivicaText] = [
        eyebrow, freeResourcesEyebrow, savingsLabel,
        redeemButton, redeemConfirmTitle, redeemConfirmBody,
    ]
}
