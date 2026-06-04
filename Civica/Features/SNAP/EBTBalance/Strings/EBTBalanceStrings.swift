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
        es: "Saldo de EBT",
        zh: "EBT 余额"
    )

    // MARK: - Hero balance card

    static let balanceEyebrow = CivicaText(
        "CalFresh balance",
        es: "Saldo de CalFresh",
        zh: "CalFresh 余额"
    )
    static let balanceRemainingSuffix = CivicaText(
        "remaining",
        es: "disponible",
        zh: "剩余"
    )
    static let lastUpdatedPrefix = CivicaText(
        "Last updated",
        es: "Última actualización",
        zh: "最后更新"
    )
    static let lastUpdatedJustNow = CivicaText(
        "Last updated just now",
        es: "Actualizado hace un momento",
        zh: "刚刚更新"
    )

    /// Velocity bar sub-label: "X spent" below the spend progress bar.
    static func velocitySpent(amount: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "\(amount) spent"
        case .mandarin: return "已花费 \(amount)"
        case .spanish: return "\(amount) gastados"
        }
    }

    // MARK: - Next deposit

    static let nextDepositLabel = CivicaText(
        "Next deposit",
        es: "Próximo depósito",
        zh: "下次存入"
    )
    /// Relative timing for the next deposit, e.g. "in 4 days" / "dentro
    /// de 4 días". The view interpolates the formatted day count.
    static func nextDepositTiming(days: Int, language: CivicaLanguage) -> String {
        switch (days, language) {
        case (0, .english), (0, .vietnamese), (0, .tagalog): return "today"
        case (0, .mandarin): return "今天"
        case (0, .spanish): return "hoy"
        case (1, .english), (1, .vietnamese), (1, .tagalog): return "tomorrow"
        case (1, .mandarin): return "明天"
        case (1, .spanish): return "mañana"
        case (_, .english), (_, .vietnamese), (_, .tagalog): return "in \(days) days"
        case (_, .mandarin): return "\(days) 天后"
        case (_, .spanish): return "dentro de \(days) días"
        }
    }

    // MARK: - Connect-card flow (unlinked state)

    static let linkEyebrow = CivicaText(
        "Connect your card",
        es: "Conecta tu tarjeta",
        zh: "连接你的卡"
    )
    static let linkTitle = CivicaText(
        "See your CalFresh balance in one place.",
        es: "Consulta tu saldo de CalFresh en un solo lugar.",
        zh: "在一个地方查看你的 CalFresh 余额。"
    )
    static let linkBody = CivicaText(
        "Link your EBT card and Civica will show your balance, recent activity, and next deposit — like connecting a bank account to a budgeting app.",
        es: "Conecta tu tarjeta EBT y Civica mostrará tu saldo, actividad reciente y próximo depósito — como conectar una cuenta bancaria a una app de presupuesto.",
        zh: "连接你的 EBT 卡,Civica 会显示你的余额、最近活动和下次存入 —— 就像把银行账户连接到记账应用一样。"
    )
    static let linkSecurityEyebrow = CivicaText(
        "What Civica never stores",
        es: "Lo que Civica nunca guarda",
        zh: "Civica 从不保存的内容"
    )
    static let linkSecurityBody = CivicaText(
        "Your PIN, your full card number, or your Social Security number. You can unlink your card anytime.",
        es: "Tu PIN, el número completo de tu tarjeta, ni tu número de Seguro Social. Puedes desconectar tu tarjeta cuando quieras.",
        zh: "你的 PIN、完整的卡号或社会安全号码。你可以随时断开卡的连接。"
    )
    static let linkCardFieldLabel = CivicaText(
        "EBT card number",
        es: "Número de tarjeta EBT",
        zh: "EBT 卡号"
    )
    static let linkStateLabel = CivicaText(
        "State",
        es: "Estado",
        zh: "州"
    )
    static let linkStateValue = CivicaText(
        "California",
        es: "California",
        zh: "California"
    )
    static let linkCTA = CivicaText(
        "Link my card",
        es: "Conectar mi tarjeta",
        zh: "连接我的卡"
    )
    static let linkingProgress = CivicaText(
        "Connecting to California EBT…",
        es: "Conectando con EBT de California…",
        zh: "正在连接 California EBT……"
    )

    // MARK: - Recent activity

    static let recentActivityEyebrow = CivicaText(
        "Recent activity",
        es: "Actividad reciente",
        zh: "最近活动"
    )
    static let depositRowLabel = CivicaText(
        "Deposit",
        es: "Depósito",
        zh: "存入"
    )

    // MARK: - Card security

    static let securityRowTitle = CivicaText(
        "Card security",
        es: "Seguridad de la tarjeta",
        zh: "卡片安全"
    )
    static let securityStatusLocked = CivicaText(
        "Locked",
        es: "Bloqueada",
        zh: "已锁定"
    )
    static let securityStatusUnlocked = CivicaText(
        "Unlocked",
        es: "Desbloqueada",
        zh: "已解锁"
    )
    /// Banner shown on the hero card while the card is locked.
    static let lockedBannerText = CivicaText(
        "Card locked — unlock it before you shop.",
        es: "Tarjeta bloqueada — desbloquéala antes de comprar.",
        zh: "卡已锁定 —— 购物前请先解锁。"
    )

    // Card-lock detail screen
    static let lockScreenTitle = CivicaText(
        "Card security",
        es: "Seguridad de la tarjeta",
        zh: "卡片安全"
    )
    /// Amber banner on EBTCardLockView that names the real action
    /// (CA EBT 1-877-328-9677) so a confused recipient doesn't
    /// believe the demo toggle locks their actual card.
    static let lockScreenDemoBannerTitle = CivicaText(
        "Demo mode — your card is not really locked",
        es: "Modo demostración — tu tarjeta no está realmente bloqueada",
        zh: "演示模式 —— 你的卡并没有真正锁定"
    )
    static let lockScreenDemoBannerBody = CivicaText(
        "This is a preview of card-lock in Civica. To actually lock a lost or stolen CalFresh card, call California EBT Customer Service at 1-877-328-9677 (free, 24/7).",
        es: "Esta es una vista previa del bloqueo de tarjeta en Civica. Para bloquear de verdad una tarjeta CalFresh perdida o robada, llama a Servicio al Cliente de EBT de California al 1-877-328-9677 (gratis, 24/7).",
        zh: "这是 Civica 中卡片锁定功能的预览。要真正锁定丢失或被盗的 CalFresh 卡,请拨打 California EBT 客户服务电话 1-877-328-9677(免费,全天 24 小时)。"
    )
    static let lockToggleTitle = CivicaText(
        "Lock my card",
        es: "Bloquear mi tarjeta",
        zh: "锁定我的卡"
    )
    static let lockToggleHelp = CivicaText(
        "Keep your card locked when you're not shopping, then unlock it right before you check out. A locked card can't be used — this is the strongest protection against EBT theft.",
        es: "Mantén tu tarjeta bloqueada cuando no estés comprando, y desbloquéala justo antes de pagar. Una tarjeta bloqueada no se puede usar — es la mejor protección contra el robo de EBT.",
        zh: "不购物时让卡保持锁定状态,结账前再解锁。锁定的卡无法使用 —— 这是防止 EBT 被盗最有力的保护。"
    )
    static let lockStatusOnLine = CivicaText(
        "Your card is locked. No purchases will go through.",
        es: "Tu tarjeta está bloqueada. No se procesarán compras.",
        zh: "你的卡已锁定。无法进行任何购物。"
    )
    static let lockStatusOffLine = CivicaText(
        "Your card is unlocked and ready to use.",
        es: "Tu tarjeta está desbloqueada y lista para usar.",
        zh: "你的卡已解锁,可以使用。"
    )
    static let lockExtrasEyebrow = CivicaText(
        "Extra protection",
        es: "Protección adicional",
        zh: "额外保护"
    )
    static let blockOutOfStateTitle = CivicaText(
        "Block out-of-state purchases",
        es: "Bloquear compras fuera del estado",
        zh: "屏蔽州外消费"
    )
    static let blockOutOfStateHelp = CivicaText(
        "Only allow purchases in California.",
        es: "Permitir compras solo en California.",
        zh: "仅允许在 California 消费。"
    )
    static let blockOnlineTitle = CivicaText(
        "Block online purchases",
        es: "Bloquear compras en línea",
        zh: "屏蔽线上消费"
    )
    static let blockOnlineHelp = CivicaText(
        "Only allow purchases in person at a store.",
        es: "Permitir compras solo en persona en una tienda.",
        zh: "仅允许在实体店当面消费。"
    )

    // MARK: - Transaction categories

    static func categoryLabel(_ category: EBTTransactionCategory, language: CivicaLanguage) -> String {
        switch (category, language) {
        case (.groceries, .english), (.groceries, .vietnamese), (.groceries, .tagalog):     return "Groceries"
        case (.groceries, .mandarin):    return "食品杂货"
        case (.groceries, .spanish):     return "Supermercado"
        case (.restaurant, .english), (.restaurant, .vietnamese), (.restaurant, .tagalog):    return "Restaurant"
        case (.restaurant, .mandarin):   return "餐厅"
        case (.restaurant, .spanish):    return "Restaurante"
        case (.farmersMarket, .english), (.farmersMarket, .vietnamese), (.farmersMarket, .tagalog): return "Farmers market"
        case (.farmersMarket, .mandarin): return "农夫市场"
        case (.farmersMarket, .spanish): return "Mercado de agricultores"
        case (.other, .english), (.other, .vietnamese), (.other, .tagalog):         return "Other"
        case (.other, .mandarin):        return "其他"
        case (.other, .spanish):         return "Otro"
        case (.deposit, .english), (.deposit, .vietnamese), (.deposit, .tagalog):       return "Deposit"
        case (.deposit, .mandarin):      return "存入"
        case (.deposit, .spanish):       return "Depósito"
        }
    }

    // MARK: - Spending insights

    static let insightsEyebrow = CivicaText(
        "This month",
        es: "Este mes",
        zh: "本月"
    )
    static let insightsSpentLabel = CivicaText(
        "Spent so far",
        es: "Gastado hasta ahora",
        zh: "已花费"
    )
    /// "At this pace, your balance lasts until May 24." The view
    /// interpolates the formatted date.
    static func insightsRunwayLine(date: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "At this pace, your balance lasts until \(date)."
        case .mandarin:
            return "按当前花费速度,你的余额可以用到 \(date)。"
        case .spanish:
            return "A este ritmo, tu saldo dura hasta el \(date)."
        }
    }

    // MARK: - "Will it last?" projection card

    /// Eyebrow for the projection card. Frames the math as a story:
    /// "how long does this balance carry me?" not "you're about to
    /// run out".
    static let projectionEyebrow = CivicaText(
        "Will it last?",
        es: "¿Te alcanzará?",
        zh: "够用吗?"
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
        case .english, .vietnamese, .tagalog:
            return "At this pace, your balance lasts through \(date). Next deposit \(depositTiming)."
        case .mandarin:
            return "按当前花费速度,你的余额可以用到 \(date)。下次存入 \(depositTiming)。"
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
        case (1, .english), (1, .vietnamese), (1, .tagalog):
            return "At this pace, your balance lasts through \(date) — about 1 day before your next deposit."
        case (1, .mandarin):
            return "按当前花费速度,你的余额可以用到 \(date) —— 大约比下次存入早 1 天。"
        case (1, .spanish):
            return "A este ritmo, tu saldo dura hasta el \(date) — aproximadamente 1 día antes de tu próximo depósito."
        case (_, .english), (_, .vietnamese), (_, .tagalog):
            return "At this pace, your balance lasts through \(date) — about \(gapDays) days before your next deposit."
        case (_, .mandarin):
            return "按当前花费速度,你的余额可以用到 \(date) —— 大约比下次存入早 \(gapDays) 天。"
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
        case .english, .vietnamese, .tagalog: return "At this pace, your balance lasts through \(date)."
        case .mandarin: return "按当前花费速度,你的余额可以用到 \(date)。"
        case .spanish: return "A este ritmo, tu saldo dura hasta el \(date)."
        }
    }

    // MARK: - Low-balance banner

    static let lowBalanceBanner = CivicaText(
        "Low balance — check your next deposit date below.",
        es: "Saldo bajo — revisa la fecha de tu próximo depósito abajo.",
        zh: "余额不足 —— 请在下方查看你下次存入的日期。"
    )

    // MARK: - Transaction detail sheet

    static let detailSheetTitle = CivicaText(
        "Transaction",
        es: "Transacción",
        zh: "交易"
    )
    static let detailCategoryLabel = CivicaText(
        "Category",
        es: "Categoría",
        zh: "类别"
    )
    static let detailDateLabel = CivicaText(
        "Date",
        es: "Fecha",
        zh: "日期"
    )
    static let detailAmountLabel = CivicaText(
        "Amount",
        es: "Monto",
        zh: "金额"
    )
    static let detailBalanceAfterLabel = CivicaText(
        "Balance after",
        es: "Saldo después",
        zh: "之后余额"
    )
    static let detailDoneButton = CivicaText(
        "Done",
        es: "Listo",
        zh: "完成"
    )

    // MARK: - Deposit schedule card

    static let depositScheduleEyebrow = CivicaText(
        "Deposit schedule",
        es: "Calendario de depósitos",
        zh: "存入时间表"
    )
    /// "CalFresh loads your card on the 5th of every month. California
    /// staggers the day by case number." The view interpolates the
    /// ordinal day.
    static func depositScheduleBody(dayOrdinal: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "CalFresh loads your card on the \(dayOrdinal) of every month. California staggers the day by case number."
        case .mandarin:
            return "CalFresh 每月在 \(dayOrdinal) 把款项加到你的卡里。California 按案件编号错开发放日期。"
        case .spanish:
            return "CalFresh carga tu tarjeta el \(dayOrdinal) de cada mes. California escalona el día según el número de caso."
        }
    }

    // MARK: - Perks + news sections

    static let perksEyebrow = CivicaText(
        "Free & discounted with EBT",
        es: "Gratis y con descuento con EBT",
        zh: "使用 EBT 免费和打折"
    )
    static let newsEyebrow = CivicaText(
        "Benefit updates",
        es: "Novedades de beneficios",
        zh: "福利更新"
    )

    // MARK: - Unlink (demo reset)

    static let unlinkLink = CivicaText(
        "Unlink this card",
        es: "Desconectar esta tarjeta",
        zh: "断开此卡的连接"
    )

    // MARK: - Demo controls (toolbar menu)

    static let demoMenuLabel = CivicaText(
        "Demo",
        es: "Demo",
        zh: "演示"
    )
    static let simulatePurchaseButton = CivicaText(
        "Simulate a purchase",
        es: "Simular una compra",
        zh: "模拟一次消费"
    )
    static let simulateDepositButton = CivicaText(
        "Simulate this month's deposit",
        es: "Simular el depósito de este mes",
        zh: "模拟本月的存入"
    )
    /// Transient "what changed" banner shown on the hero card right
    /// after a simulated deposit lands. The view interpolates the
    /// formatted amount.
    static func depositLandedBanner(amount: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Your \(amount) CalFresh deposit landed."
        case .mandarin:
            return "你的 \(amount) CalFresh 存款已到账。"
        case .spanish:
            return "Tu depósito de CalFresh de \(amount) llegó."
        }
    }

    // MARK: - IS-1 refresh error banner (audit 2026-05-29)

    /// Headline copy in the dismissible "couldn't update" banner. The
    /// view interpolates the short-style timestamp of the last
    /// successful refresh (or a fallback when none exists yet).
    static func refreshErrorBannerBody(asOf: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Couldn't update. Showing balance as of \(asOf)."
        case .mandarin:
            return "无法更新。显示截至 \(asOf) 的余额。"
        case .spanish:
            return "No se pudo actualizar. Mostrando el saldo a las \(asOf)."
        }
    }
    /// Fallback when no prior successful refresh exists (first launch
    /// after a fresh install, etc).
    static let refreshErrorBannerNoTimestamp = CivicaText(
        "Couldn't update right now.",
        es: "No se pudo actualizar ahora.",
        zh: "现在无法更新。"
    )
    static let refreshErrorRetry = CivicaText(
        "Retry",
        es: "Reintentar",
        zh: "重试"
    )
    static let refreshErrorDismiss = CivicaText(
        "Dismiss",
        es: "Cerrar",
        zh: "关闭"
    )
    static func refreshErrorAccessibilityLabel(asOf: String?, language: CivicaLanguage) -> String {
        switch (asOf, language) {
        case (let when?, .english), (let when?, .vietnamese), (let when?, .tagalog):
            return "Could not update balance. Last update at \(when)."
        case (let when?, .mandarin):
            return "无法更新余额。上次更新时间 \(when)。"
        case (let when?, .spanish):
            return "No se pudo actualizar el saldo. Última actualización a las \(when)."
        case (nil, .english), (nil, .vietnamese), (nil, .tagalog):
            return "Could not update balance."
        case (nil, .mandarin):
            return "无法更新余额。"
        case (nil, .spanish):
            return "No se pudo actualizar el saldo."
        }
    }

    // MARK: - Benefits expiration note

    static let expirationEyebrow = CivicaText(
        "Use it or lose it",
        es: "Úsalo o piérdelo",
        zh: "不用就会失效"
    )
    /// "CalFresh removes benefits left unused for 9 months. Keep using
    /// your card — your balance is good through <date>." The view
    /// interpolates the formatted month/year.
    static func expirationBody(goodThrough: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog:
            return "CalFresh removes benefits left completely unused for 9 months. Keep using your card — your balance is good through \(goodThrough)."
        case .mandarin:
            return "如果福利 9 个月完全没有使用,CalFresh 会将其收回。继续使用你的卡 —— 你的余额在 \(goodThrough) 之前有效。"
        case .spanish:
            return "CalFresh elimina los beneficios que no se usan durante 9 meses. Sigue usando tu tarjeta — tu saldo es válido hasta \(goodThrough)."
        }
    }

    // MARK: - Demo disclosure

    static let demoDisclosure = CivicaText(
        "Demo — not connected to a real EBT account.",
        es: "Demostración — no está conectado a una cuenta EBT real.",
        zh: "演示 —— 未连接到真实的 EBT 账户。"
    )

    // MARK: - Card-lock "coming soon" (Phase 2 / Lane H)
    //
    // 10 strings for the honest CA card-lock UX. The coming-soon
    // banner uses pine (action surface), not amber (warning). The
    // app-only toggle copy is explicit that it does NOT freeze the
    // card at the processor.

    static let lockComingSoonHeadline = CivicaText(
        "We can't lock your CalFresh card directly yet.",
        es: "Aún no podemos bloquear tu tarjeta CalFresh directamente.",
        zh: "我们目前还不能直接锁定你的 CalFresh 卡。"
    )
    static let lockComingSoonBody = CivicaText(
        "If your card is lost or stolen, use the steps below immediately.",
        es: "Si perdiste tu tarjeta o te la robaron, sigue los pasos de abajo de inmediato.",
        zh: "如果你的卡丢失或被盗,请立即按下面的步骤操作。"
    )
    static let lockEmergencyStepCall = CivicaText(
        "Call EBT Customer Service: 1-877-328-9677",
        es: "Llama al Servicio al Cliente de EBT: 1-877-328-9677",
        zh: "拨打 EBT 客户服务电话:1-877-328-9677"
    )
    static let lockEmergencyStepPortal = CivicaText(
        "Visit ebt.ca.gov to report online",
        es: "Visita ebt.ca.gov para reportar en línea",
        zh: "访问 ebt.ca.gov 在线挂失"
    )
    static let lockEmergencyStepPolice = CivicaText(
        "Report to local police if stolen",
        es: "Repórtalo a la policía local si fue robada",
        zh: "如果被盗,请向当地警方报案"
    )
    static let lockAppOnlyTitle = CivicaText(
        "Hide card in this app",
        es: "Ocultar tarjeta en esta aplicación",
        zh: "在本应用中隐藏卡片"
    )
    static let lockAppOnlySubtitle = CivicaText(
        "This does NOT prevent transactions. Use the steps above to actually freeze your card.",
        es: "Esto NO evita transacciones. Usa los pasos de arriba para bloquear tu tarjeta de verdad.",
        zh: "这不会阻止交易。请按上面的步骤真正冻结你的卡。"
    )
    static let lockWhyTitle = CivicaText(
        "Why can't I lock here?",
        es: "¿Por qué no puedo bloquearla aquí?",
        zh: "为什么我不能在这里锁定?"
    )
    static let lockWhyParagraph1 = CivicaText(
        "CalFresh card locks require the California processor (Conduent/FIS) to expose an API to third-party apps. They haven't done this yet.",
        es: "Los bloqueos de tarjeta CalFresh requieren que el procesador de California (Conduent/FIS) exponga una API a aplicaciones de terceros. Aún no lo han hecho.",
        zh: "锁定 CalFresh 卡需要 California 的处理方(Conduent/FIS)向第三方应用开放 API。他们目前还没有这么做。"
    )
    static let lockWhyParagraph2 = CivicaText(
        "Civica is working with CDSS on a 2026 partnership that would enable this. We'll notify you when it's available.",
        es: "Civica está trabajando con el CDSS en una asociación para 2026 que permitiría esto. Te avisaremos cuando esté disponible.",
        zh: "Civica 正在与 CDSS 合作,推动一项 2026 年的合作来实现这一功能。功能上线后我们会通知你。"
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
        es: "No pudimos conectar con EBT de California en este momento. Inténtalo de nuevo en un momento.",
        zh: "我们现在无法连接到 California EBT。请稍后再试。"
    )
    static let networkTimeoutCTA = CivicaText(
        "Try again",
        es: "Intentar de nuevo",
        zh: "重试"
    )

    static let portalDownBanner = CivicaText(
        "California EBT is temporarily unavailable. We'll keep trying — check back soon.",
        es: "EBT de California no está disponible temporalmente. Seguiremos intentando — vuelve pronto.",
        zh: "California EBT 暂时无法使用。我们会继续尝试 —— 请稍后再来查看。"
    )
    static let portalDownCTA = CivicaText(
        "Try again",
        es: "Intentar de nuevo",
        zh: "重试"
    )

    static let sessionExpiredBanner = CivicaText(
        "Your EBT card link expired. Re-link your card to see your balance.",
        es: "El enlace de tu tarjeta EBT venció. Vuelve a conectar tu tarjeta para ver tu saldo.",
        zh: "你的 EBT 卡连接已过期。请重新连接卡片以查看余额。"
    )
    static let sessionExpiredCTA = CivicaText(
        "Re-link card",
        es: "Reconectar tarjeta",
        zh: "重新连接卡片"
    )

    static let captchaBanner = CivicaText(
        "California EBT asked us to verify it's really you. Re-link your card to continue.",
        es: "EBT de California nos pidió verificar que eres tú. Vuelve a conectar tu tarjeta para continuar.",
        zh: "California EBT 要求我们验证确实是你本人。请重新连接卡片以继续。"
    )
    static let captchaCTA = CivicaText(
        "Re-link card",
        es: "Reconectar tarjeta",
        zh: "重新连接卡片"
    )

    static let pinLockedBanner = CivicaText(
        "Your EBT card is locked after too many PIN attempts. Call California EBT to unlock it.",
        es: "Tu tarjeta EBT está bloqueada después de demasiados intentos de PIN. Llama a EBT de California para desbloquearla.",
        zh: "PIN 尝试次数过多,你的 EBT 卡已被锁定。请致电 California EBT 解锁。"
    )
    static let pinLockedCTA = CivicaText(
        "Call 1-877-328-9677",
        es: "Llamar 1-877-328-9677",
        zh: "拨打 1-877-328-9677"
    )

    static let cardClosedBanner = CivicaText(
        "California EBT shows this card is closed. Contact your county office to get a replacement.",
        es: "EBT de California muestra que esta tarjeta está cerrada. Comunícate con la oficina de tu condado para obtener un reemplazo.",
        zh: "California EBT 显示此卡已关闭。请联系你所在县的办公室办理补办。"
    )
    static let cardClosedCTA = CivicaText(
        "Find county office",
        es: "Buscar oficina del condado",
        zh: "查找县办公室"
    )

    static let parseErrorBanner = CivicaText(
        "We're having trouble reading your EBT balance. Civica's team has been notified.",
        es: "Tenemos problemas para leer tu saldo de EBT. Notificamos al equipo de Civica.",
        zh: "我们读取你的 EBT 余额时遇到问题。Civica 团队已收到通知。"
    )
    static let parseErrorCTA = CivicaText(
        "Try again",
        es: "Intentar de nuevo",
        zh: "重试"
    )

    static let cardLockUnsupportedBanner = CivicaText(
        "Card lock isn't available in California yet. We'll turn it on the moment the state supports it.",
        es: "El bloqueo de tarjeta aún no está disponible en California. Lo activaremos en cuanto el estado lo permita.",
        zh: "California 目前还不支持卡片锁定功能。州里一旦支持,我们就会立刻开启。"
    )
    static let cardLockUnsupportedCTA = CivicaText(
        "Learn more",
        es: "Más información",
        zh: "了解更多"
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
        lockScreenTitle, lockScreenDemoBannerTitle, lockScreenDemoBannerBody,
        lockToggleTitle, lockToggleHelp,
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
        lockComingSoonHeadline, lockComingSoonBody,
        lockEmergencyStepCall, lockEmergencyStepPortal, lockEmergencyStepPolice,
        lockAppOnlyTitle, lockAppOnlySubtitle,
        lockWhyTitle, lockWhyParagraph1, lockWhyParagraph2,
        networkTimeoutBanner, networkTimeoutCTA,
        portalDownBanner, portalDownCTA,
        sessionExpiredBanner, sessionExpiredCTA,
        captchaBanner, captchaCTA,
        pinLockedBanner, pinLockedCTA,
        cardClosedBanner, cardClosedCTA,
        parseErrorBanner, parseErrorCTA,
        cardLockUnsupportedBanner, cardLockUnsupportedCTA,
        refreshErrorBannerNoTimestamp, refreshErrorRetry, refreshErrorDismiss,
    ]
}
