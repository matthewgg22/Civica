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

    // MARK: - Connect-card flow (unlinked state)

    static let linkEyebrow = CivicaText(
        "Connect your card",
        es: "Conecta tu tarjeta"
    )
    static let linkTitle = CivicaText(
        "See your CalFresh balance in one place.",
        es: "Consulta tu saldo de CalFresh en un solo lugar."
    )
    static let linkBody = CivicaText(
        "Link your EBT card and Civica will show your balance, recent activity, and next deposit — like connecting a bank account to a budgeting app.",
        es: "Conecta tu tarjeta EBT y Civica mostrará tu saldo, actividad reciente y próximo depósito — como conectar una cuenta bancaria a una app de presupuesto."
    )
    static let linkSecurityEyebrow = CivicaText(
        "What Civica never stores",
        es: "Lo que Civica nunca guarda"
    )
    static let linkSecurityBody = CivicaText(
        "Your PIN, your full card number, or your Social Security number. You can unlink your card anytime.",
        es: "Tu PIN, el número completo de tu tarjeta, ni tu número de Seguro Social. Puedes desconectar tu tarjeta cuando quieras."
    )
    static let linkCardFieldLabel = CivicaText(
        "EBT card number",
        es: "Número de tarjeta EBT"
    )
    static let linkStateLabel = CivicaText(
        "State",
        es: "Estado"
    )
    static let linkStateValue = CivicaText(
        "California",
        es: "California"
    )
    static let linkCTA = CivicaText(
        "Link my card",
        es: "Conectar mi tarjeta"
    )
    static let linkingProgress = CivicaText(
        "Connecting to California EBT…",
        es: "Conectando con EBT de California…"
    )

    // MARK: - Recent activity

    static let recentActivityEyebrow = CivicaText(
        "Recent activity",
        es: "Actividad reciente"
    )
    static let depositRowLabel = CivicaText(
        "Deposit",
        es: "Depósito"
    )

    // MARK: - Unlink (demo reset)

    static let unlinkLink = CivicaText(
        "Unlink this card",
        es: "Desconectar esta tarjeta"
    )

    // MARK: - Demo disclosure

    static let demoDisclosure = CivicaText(
        "Demo — not connected to a real EBT account.",
        es: "Demostración — no está conectado a una cuenta EBT real."
    )
}
