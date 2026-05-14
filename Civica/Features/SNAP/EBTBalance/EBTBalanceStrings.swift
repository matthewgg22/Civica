import CivicaDesignSystem

// String table for the Check EBT Balance feature. EN/ES parity per
// HANDOFF #4.
//
// Framing note: this feature is a *demo* of what a Propel-style
// balance dashboard would look like in Civica. It does not connect
// to a real state EBT system. Disclosure copy lives here so every
// screen pulls from the same source.

enum EBTBalanceStrings {
    static let screenTitle = CivicaText(
        "EBT Balance",
        es: "Saldo de EBT"
    )

    // MARK: - Hero balance card

    static let balanceEyebrow = CivicaText(
        "CalFresh balance",
        es: "Saldo de CalFresh"
    )
    static let balanceRemainingSuffix = CivicaText(
        "remaining",
        es: "disponible"
    )
    static let lastUpdatedPrefix = CivicaText(
        "Last updated",
        es: "Última actualización"
    )

    // MARK: - Next deposit

    static let nextDepositLabel = CivicaText(
        "Next deposit",
        es: "Próximo depósito"
    )
    /// Relative timing for the next deposit, e.g. "in 4 days" / "dentro
    /// de 4 días". The view interpolates the formatted day count.
    static func nextDepositTiming(days: Int, language: CivicaLanguage) -> String {
        switch (days, language) {
        case (0, .english): return "today"
        case (0, .spanish): return "hoy"
        case (1, .english): return "tomorrow"
        case (1, .spanish): return "mañana"
        case (_, .english): return "in \(days) days"
        case (_, .spanish): return "dentro de \(days) días"
        }
    }

    // MARK: - Demo disclosure

    static let demoDisclosure = CivicaText(
        "Demo — not connected to a real EBT account.",
        es: "Demostración — no está conectado a una cuenta EBT real."
    )
}
