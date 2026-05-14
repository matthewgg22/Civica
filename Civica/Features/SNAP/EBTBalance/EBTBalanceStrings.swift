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
    static let lastUpdatedJustNow = CivicaText(
        "Last updated just now",
        es: "Actualizado hace un momento"
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

    // MARK: - Card security

    static let securityRowTitle = CivicaText(
        "Card security",
        es: "Seguridad de la tarjeta"
    )
    static let securityStatusLocked = CivicaText(
        "Locked",
        es: "Bloqueada"
    )
    static let securityStatusUnlocked = CivicaText(
        "Unlocked",
        es: "Desbloqueada"
    )
    /// Banner shown on the hero card while the card is locked.
    static let lockedBannerText = CivicaText(
        "Card locked — unlock it before you shop.",
        es: "Tarjeta bloqueada — desbloquéala antes de comprar."
    )

    // Card-lock detail screen
    static let lockScreenTitle = CivicaText(
        "Card security",
        es: "Seguridad de la tarjeta"
    )
    static let lockToggleTitle = CivicaText(
        "Lock my card",
        es: "Bloquear mi tarjeta"
    )
    static let lockToggleHelp = CivicaText(
        "Keep your card locked when you're not shopping, then unlock it right before you check out. A locked card can't be used — this is the strongest protection against EBT theft.",
        es: "Mantén tu tarjeta bloqueada cuando no estés comprando, y desbloquéala justo antes de pagar. Una tarjeta bloqueada no se puede usar — es la mejor protección contra el robo de EBT."
    )
    static let lockStatusOnLine = CivicaText(
        "Your card is locked. No purchases will go through.",
        es: "Tu tarjeta está bloqueada. No se procesarán compras."
    )
    static let lockStatusOffLine = CivicaText(
        "Your card is unlocked and ready to use.",
        es: "Tu tarjeta está desbloqueada y lista para usar."
    )
    static let lockExtrasEyebrow = CivicaText(
        "Extra protection",
        es: "Protección adicional"
    )
    static let blockOutOfStateTitle = CivicaText(
        "Block out-of-state purchases",
        es: "Bloquear compras fuera del estado"
    )
    static let blockOutOfStateHelp = CivicaText(
        "Only allow purchases in California.",
        es: "Permitir compras solo en California."
    )
    static let blockOnlineTitle = CivicaText(
        "Block online purchases",
        es: "Bloquear compras en línea"
    )
    static let blockOnlineHelp = CivicaText(
        "Only allow purchases in person at a store.",
        es: "Permitir compras solo en persona en una tienda."
    )

    // MARK: - Transaction categories

    static func categoryLabel(_ category: EBTTransactionCategory, language: CivicaLanguage) -> String {
        switch (category, language) {
        case (.groceries, .english):     return "Groceries"
        case (.groceries, .spanish):     return "Supermercado"
        case (.restaurant, .english):    return "Restaurant"
        case (.restaurant, .spanish):    return "Restaurante"
        case (.farmersMarket, .english): return "Farmers market"
        case (.farmersMarket, .spanish): return "Mercado de agricultores"
        case (.other, .english):         return "Other"
        case (.other, .spanish):         return "Otro"
        case (.deposit, .english):       return "Deposit"
        case (.deposit, .spanish):       return "Depósito"
        }
    }

    // MARK: - Spending insights

    static let insightsEyebrow = CivicaText(
        "This month",
        es: "Este mes"
    )
    static let insightsSpentLabel = CivicaText(
        "Spent so far",
        es: "Gastado hasta ahora"
    )
    /// "At this pace, your balance lasts until May 24." The view
    /// interpolates the formatted date.
    static func insightsRunwayLine(date: String, language: CivicaLanguage) -> String {
        language == .english
            ? "At this pace, your balance lasts until \(date)."
            : "A este ritmo, tu saldo dura hasta el \(date)."
    }

    // MARK: - Low-balance banner

    static let lowBalanceBanner = CivicaText(
        "Low balance — check your next deposit date below.",
        es: "Saldo bajo — revisa la fecha de tu próximo depósito abajo."
    )

    // MARK: - Transaction detail sheet

    static let detailSheetTitle = CivicaText(
        "Transaction",
        es: "Transacción"
    )
    static let detailCategoryLabel = CivicaText(
        "Category",
        es: "Categoría"
    )
    static let detailDateLabel = CivicaText(
        "Date",
        es: "Fecha"
    )
    static let detailAmountLabel = CivicaText(
        "Amount",
        es: "Monto"
    )
    static let detailBalanceAfterLabel = CivicaText(
        "Balance after",
        es: "Saldo después"
    )
    static let detailDoneButton = CivicaText(
        "Done",
        es: "Listo"
    )

    // MARK: - Deposit schedule card

    static let depositScheduleEyebrow = CivicaText(
        "Deposit schedule",
        es: "Calendario de depósitos"
    )
    /// "CalFresh loads your card on the 5th of every month. California
    /// staggers the day by case number." The view interpolates the
    /// ordinal day.
    static func depositScheduleBody(dayOrdinal: String, language: CivicaLanguage) -> String {
        language == .english
            ? "CalFresh loads your card on the \(dayOrdinal) of every month. California staggers the day by case number."
            : "CalFresh carga tu tarjeta el \(dayOrdinal) de cada mes. California escalona el día según el número de caso."
    }

    // MARK: - Perks + news sections

    static let perksEyebrow = CivicaText(
        "Free & discounted with EBT",
        es: "Gratis y con descuento con EBT"
    )
    static let newsEyebrow = CivicaText(
        "Benefit updates",
        es: "Novedades de beneficios"
    )

    // MARK: - Unlink (demo reset)

    static let unlinkLink = CivicaText(
        "Unlink this card",
        es: "Desconectar esta tarjeta"
    )

    // MARK: - Demo controls (toolbar menu)

    static let demoMenuLabel = CivicaText(
        "Demo",
        es: "Demo"
    )
    static let simulatePurchaseButton = CivicaText(
        "Simulate a purchase",
        es: "Simular una compra"
    )
    static let simulateDepositButton = CivicaText(
        "Simulate this month's deposit",
        es: "Simular el depósito de este mes"
    )
    /// Transient "what changed" banner shown on the hero card right
    /// after a simulated deposit lands. The view interpolates the
    /// formatted amount.
    static func depositLandedBanner(amount: String, language: CivicaLanguage) -> String {
        language == .english
            ? "Your \(amount) CalFresh deposit landed."
            : "Tu depósito de CalFresh de \(amount) llegó."
    }

    // MARK: - Benefits expiration note

    static let expirationEyebrow = CivicaText(
        "Use it or lose it",
        es: "Úsalo o piérdelo"
    )
    /// "CalFresh removes benefits left unused for 9 months. Keep using
    /// your card — your balance is good through <date>." The view
    /// interpolates the formatted month/year.
    static func expirationBody(goodThrough: String, language: CivicaLanguage) -> String {
        language == .english
            ? "CalFresh removes benefits left completely unused for 9 months. Keep using your card — your balance is good through \(goodThrough)."
            : "CalFresh elimina los beneficios que no se usan durante 9 meses. Sigue usando tu tarjeta — tu saldo es válido hasta \(goodThrough)."
    }

    // MARK: - Demo disclosure

    static let demoDisclosure = CivicaText(
        "Demo — not connected to a real EBT account.",
        es: "Demostración — no está conectado a una cuenta EBT real."
    )
}
