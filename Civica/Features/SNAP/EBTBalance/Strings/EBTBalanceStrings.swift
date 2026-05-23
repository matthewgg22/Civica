import CivicaDesignSystem

// String table for the Check EBT Balance feature. EN/ES parity per
// HANDOFF #4 (enforced by EBTStringParityTests, per plan §16.8).
//
// Per plan Q2/D9: strings are split per feature into Strings/EBT*.swift
// files. This namespace owns balance-dashboard + link-flow + scrape-
// error copy. Push, receipt, anomaly, account-services, perks, and
// referral copy live in sibling files.
//
// Framing note: the original "demo" framing is preserved at flag-OFF
// per the IRON RULE; once `FeatureFlags.ebtRealData` is on, the
// demoDisclosure string and demo controls are hidden by the views.

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

    /// Velocity bar sub-label: "X spent" below the spend progress bar.
    static func velocitySpent(amount: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(amount) spent"
        case .spanish: return "\(amount) gastados"
        }
    }

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

    // MARK: - "Will it last?" projection card

    /// Eyebrow for the projection card. Frames the math as a story:
    /// "how long does this balance carry me?" not "you're about to
    /// run out".
    static let projectionEyebrow = CivicaText(
        "Will it last?",
        es: "¿Te alcanzará?"
    )

    /// Good case: projection ≥ next deposit, or no deposit on file.
    /// Pine/positive treatment. "At this pace, your balance lasts
    /// through May 24. Next deposit in 4 days." The view interpolates
    /// the formatted date and deposit timing phrase.
    static func projectionGood(
        date: String,
        depositTiming: String,
        language: CivicaLanguage
    ) -> String {
        switch language {
        case .english:
            return "At this pace, your balance lasts through \(date). Next deposit \(depositTiming)."
        case .spanish:
            return "A este ritmo, tu saldo dura hasta el \(date). Próximo depósito \(depositTiming)."
        }
    }

    /// Tight case: projection < next deposit. Amber warning. "At this
    /// pace, your balance lasts through May 24 — about 3 days before
    /// your next deposit." The view interpolates the date and the
    /// integer day gap.
    static func projectionTight(
        date: String,
        gapDays: Int,
        language: CivicaLanguage
    ) -> String {
        switch (gapDays, language) {
        case (1, .english):
            return "At this pace, your balance lasts through \(date) — about 1 day before your next deposit."
        case (1, .spanish):
            return "A este ritmo, tu saldo dura hasta el \(date) — aproximadamente 1 día antes de tu próximo depósito."
        case (_, .english):
            return "At this pace, your balance lasts through \(date) — about \(gapDays) days before your next deposit."
        case (_, .spanish):
            return "A este ritmo, tu saldo dura hasta el \(date) — aproximadamente \(gapDays) días antes de tu próximo depósito."
        }
    }

    /// Neutral case: projection exists, no next deposit on file. "At
    /// this pace, your balance lasts through May 24." The view
    /// interpolates the formatted date.
    static func projectionNeutral(
        date: String,
        language: CivicaLanguage
    ) -> String {
        switch language {
        case .english: return "At this pace, your balance lasts through \(date)."
        case .spanish: return "A este ritmo, tu saldo dura hasta el \(date)."
        }
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

    // MARK: - EBTScrapeError banners + CTAs (per plan §16.2 / D10)
    //
    // 7 variants — networkTimeout, portalDown, sessionExpired, captcha,
    // pinLocked, cardClosed, parseError. Each gets a recipient-readable
    // banner string and a CTA label. The cardLockUnsupported case is a
    // CA-specific "not available in your state" state — distinct
    // copy.
    //
    // Banner copy reads at fourth-grade level and avoids surfacing the
    // technical reason. The CTA tells the recipient the single next
    // action.

    static let networkTimeoutBanner = CivicaText(
        "We couldn't reach California EBT just now. Try again in a moment.",
        es: "No pudimos conectar con EBT de California en este momento. Inténtalo de nuevo en un momento."
    )
    static let networkTimeoutCTA = CivicaText(
        "Try again",
        es: "Intentar de nuevo"
    )

    static let portalDownBanner = CivicaText(
        "California EBT is temporarily unavailable. We'll keep trying — check back soon.",
        es: "EBT de California no está disponible temporalmente. Seguiremos intentando — vuelve pronto."
    )
    static let portalDownCTA = CivicaText(
        "Try again",
        es: "Intentar de nuevo"
    )

    static let sessionExpiredBanner = CivicaText(
        "Your EBT card link expired. Re-link your card to see your balance.",
        es: "El enlace de tu tarjeta EBT venció. Vuelve a conectar tu tarjeta para ver tu saldo."
    )
    static let sessionExpiredCTA = CivicaText(
        "Re-link card",
        es: "Reconectar tarjeta"
    )

    static let captchaBanner = CivicaText(
        "California EBT asked us to verify it's really you. Re-link your card to continue.",
        es: "EBT de California nos pidió verificar que eres tú. Vuelve a conectar tu tarjeta para continuar."
    )
    static let captchaCTA = CivicaText(
        "Re-link card",
        es: "Reconectar tarjeta"
    )

    static let pinLockedBanner = CivicaText(
        "Your EBT card is locked after too many PIN attempts. Call California EBT to unlock it.",
        es: "Tu tarjeta EBT está bloqueada después de demasiados intentos de PIN. Llama a EBT de California para desbloquearla."
    )
    static let pinLockedCTA = CivicaText(
        "Call 1-877-328-9677",
        es: "Llamar 1-877-328-9677"
    )

    static let cardClosedBanner = CivicaText(
        "California EBT shows this card is closed. Contact your county office to get a replacement.",
        es: "EBT de California muestra que esta tarjeta está cerrada. Comunícate con la oficina de tu condado para obtener un reemplazo."
    )
    static let cardClosedCTA = CivicaText(
        "Find county office",
        es: "Buscar oficina del condado"
    )

    static let parseErrorBanner = CivicaText(
        "We're having trouble reading your EBT balance. Civica's team has been notified.",
        es: "Tenemos problemas para leer tu saldo de EBT. Notificamos al equipo de Civica."
    )
    static let parseErrorCTA = CivicaText(
        "Try again",
        es: "Intentar de nuevo"
    )

    static let cardLockUnsupportedBanner = CivicaText(
        "Card lock isn't available in California yet. We'll turn it on the moment the state supports it.",
        es: "El bloqueo de tarjeta aún no está disponible en California. Lo activaremos en cuanto el estado lo permita."
    )
    static let cardLockUnsupportedCTA = CivicaText(
        "Learn more",
        es: "Más información"
    )

    // MARK: - Parity introspection
    //
    // Swift's `Mirror` cannot reflect static properties on enum
    // namespaces, so EBTStringParityTests can't auto-discover entries
    // (the plan §16.8 stub is aspirational on this point). Instead,
    // each namespace exposes `all` — a manually-curated list of every
    // CivicaText constant. Adding a new string requires appending it
    // here; the parity test failing is the safety net if you forget.

    static let all: [CivicaText] = [
        screenTitle,
        balanceEyebrow, balanceRemainingSuffix, lastUpdatedPrefix, lastUpdatedJustNow,
        nextDepositLabel,
        linkEyebrow, linkTitle, linkBody, linkSecurityEyebrow, linkSecurityBody,
        linkCardFieldLabel, linkStateLabel, linkStateValue, linkCTA, linkingProgress,
        recentActivityEyebrow, depositRowLabel,
        securityRowTitle, securityStatusLocked, securityStatusUnlocked, lockedBannerText,
        lockScreenTitle, lockToggleTitle, lockToggleHelp,
        lockStatusOnLine, lockStatusOffLine, lockExtrasEyebrow,
        blockOutOfStateTitle, blockOutOfStateHelp, blockOnlineTitle, blockOnlineHelp,
        insightsEyebrow, insightsSpentLabel,
        lowBalanceBanner,
        detailSheetTitle, detailCategoryLabel, detailDateLabel, detailAmountLabel,
        detailBalanceAfterLabel, detailDoneButton,
        depositScheduleEyebrow,
        perksEyebrow, newsEyebrow,
        unlinkLink,
        demoMenuLabel, simulatePurchaseButton, simulateDepositButton,
        expirationEyebrow,
        demoDisclosure,
        networkTimeoutBanner, networkTimeoutCTA,
        portalDownBanner, portalDownCTA,
        sessionExpiredBanner, sessionExpiredCTA,
        captchaBanner, captchaCTA,
        pinLockedBanner, pinLockedCTA,
        cardClosedBanner, cardClosedCTA,
        parseErrorBanner, parseErrorCTA,
        cardLockUnsupportedBanner, cardLockUnsupportedCTA,
    ]
}
