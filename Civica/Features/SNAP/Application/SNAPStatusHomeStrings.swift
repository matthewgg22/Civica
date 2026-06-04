import Foundation

// Strings for HANDOFF boards 11 (status home), 12 (returning user
// home), and 24 (the waiting room). Every visible string keyed for
// English + Spanish per HANDOFF #4 Spanish parity gate.

enum SNAPStatusHomeStrings {

    // MARK: - Returning user home (board 12)

    static let returningWelcome = CivicaText(
        "Welcome back",
        es: "Bienvenido de nuevo",
        zh: "欢迎回来"
    )
    static let returningSubtitle = CivicaText(
        "Here's where your SNAP application stands.",
        es: "Aquí está el estado de tu solicitud de SNAP.",
        zh: "这是你 SNAP 申请的当前状态。"
    )
    static let returningResume = CivicaText(
        "Continue where you left off",
        es: "Continuar donde lo dejaste",
        zh: "从上次停下的地方继续"
    )
    static let returningStartOver = CivicaText(
        "Start over",
        es: "Empezar de nuevo",
        zh: "重新开始"
    )

    // MARK: - Waiting room (board 24)

    static let waitingTitle = CivicaText(
        "What's happening now",
        es: "Qué está pasando ahora",
        zh: "现在的进展"
    )
    static func waitingBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Your application is with \(agency). Most decisions take 7–30 days. We'll let you know when something changes."
        case .mandarin:
            return "你的申请已交给 \(agency)。大多数决定需要 7 到 30 天。有任何变化我们会通知你。"
        case .spanish:
            return "Tu solicitud está con \(agency). La mayoría de las decisiones tardan de 7 a 30 días. Te avisaremos cuando algo cambie."
        }
    }
    // MARK: - Action chips / next step prompts

    static let actionGeneratePacket = CivicaText(
        "Generate your application packet",
        es: "Genera tu paquete de solicitud",
        zh: "生成你的申请材料包"
    )
    /// Link-out CTA: "Open <portal> to submit". Per OBBBA Q14, the
    /// "Submit to <portal>" framing is banned (implies a Civica->state
    /// write integration without written authorization); the
    /// "Open <portal> to submit" framing is the approved fallback.
    static func actionSubmitToState(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalLabel = portal.isEmpty ? "your state portal" : portal
        switch language {
        case .english, .vietnamese, .tagalog: return "Open \(portalLabel) to submit"
        case .mandarin: return "打开 \(portalLabel) 提交申请"
        case .spanish: return "Abrir \(portalLabel) para enviar"
        }
    }
    static let actionUploadRequested = CivicaText(
        "Upload requested documents",
        es: "Sube los documentos solicitados",
        zh: "上传所需文件"
    )
    static let actionPrepareInterview = CivicaText(
        "Prepare for your interview",
        es: "Prepárate para tu entrevista",
        zh: "为你的面谈做准备"
    )
    static let actionViewDecision = CivicaText(
        "View your decision",
        es: "Ver tu decisión",
        zh: "查看你的审核结果"
    )
    static let actionRecert = CivicaText(
        "Start your recertification",
        es: "Comienza tu recertificación",
        zh: "开始你的复审"
    )

    // MARK: - Timeline step labels

    static let stepScreener = CivicaText(
        "Eligibility screener",
        es: "Evaluación de elegibilidad",
        zh: "资格预审"
    )
    static let stepPacket = CivicaText(
        "Application packet generated",
        es: "Paquete de solicitud generado",
        zh: "申请材料包已生成"
    )
    /// Timeline-step label that mirrors `actionSubmitToState`.
    static func stepSubmit(stateCode: String?, language: CivicaLanguage) -> String {
        actionSubmitToState(stateCode: stateCode, language: language)
    }
    static let stepStateAcknowledged = CivicaText(
        "State received your application",
        es: "El estado recibió tu solicitud",
        zh: "州政府已收到你的申请"
    )
    static let stepDocuments = CivicaText(
        "Documents requested",
        es: "Documentos solicitados",
        zh: "需要补交文件"
    )
    static let stepInterview = CivicaText(
        "Phone interview",
        es: "Entrevista telefónica",
        zh: "电话面谈"
    )
    static let stepDecision = CivicaText(
        "Decision",
        es: "Decisión",
        zh: "审核结果"
    )

    // MARK: - Detail lines under timeline steps

    static let detailEstimatedBenefit = CivicaText(
        "Estimated benefit: %@",
        es: "Beneficio estimado: %@",
        zh: "预计补助:%@"
    )

    static func estimatedBenefit(amountText: String, language: CivicaLanguage) -> String {
        detailEstimatedBenefit.value(in: language)
            .replacingOccurrences(of: "%@", with: amountText)
    }

    // MARK: - Status indicators

    static let statusComplete = CivicaText("Complete", es: "Completado", zh: "已完成")
    static let statusInProgress = CivicaText("In progress", es: "En curso", zh: "进行中")
    static let statusActionNeeded = CivicaText("Action needed", es: "Acción necesaria", zh: "需要处理")
    static let statusWaiting = CivicaText("Waiting", es: "En espera", zh: "等待中")

    // MARK: - Denial surface (board 23 · denial path)
    //
    // Brand voice rule: honest acknowledgment, no fabricated optimism,
    // no "we're working hard for you" filler. Every line below names
    // a real next step the user can act on today.

    static let deniedTitle = CivicaText(
        "Your SNAP application was denied",
        es: "Tu solicitud de SNAP fue denegada",
        zh: "你的 SNAP 申请被拒绝了"
    )
    static func deniedBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .vietnamese, .tagalog:
            return "\(agency) decided you don't qualify right now. You have options — denials are not the end of the road."
        case .mandarin:
            return "\(agency) 认定你目前不符合资格。你还有其他选择 —— 被拒并不是终点。"
        case .spanish:
            return "\(agency) decidió que no calificas en este momento. Tienes opciones — una denegación no es el final del camino."
        }
    }
    static let deniedReasonHeading = CivicaText(
        "What the state told us",
        es: "Lo que nos dijo el estado",
        zh: "州政府告诉我们的信息"
    )
    static func deniedReasonMissing(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalRef = portal.isEmpty ? "your state portal" : portal
        switch language {
        case .english, .vietnamese, .tagalog:
            return "The state hasn't shared a specific reason with Civica yet. Check your \(portalRef) inbox or the denial notice you received in the mail."
        case .mandarin:
            return "州政府还没有把具体原因告知 Civica。请查看你的 \(portalRef) 收件箱,或邮寄收到的拒绝通知书。"
        case .spanish:
            return "El estado todavía no ha compartido una razón específica con Civica. Revisa tu bandeja de \(portalRef) o la carta de denegación que recibiste por correo."
        }
    }

    static let deniedNextStepsHeading = CivicaText(
        "What you can do next",
        es: "Qué puedes hacer ahora",
        zh: "你接下来可以做什么"
    )

    // Appeal — 90-day fair hearing right is federal (7 CFR 273.15).
    static let deniedAppealTitle = CivicaText(
        "Request a fair hearing",
        es: "Solicitar una audiencia justa",
        zh: "申请公正听证"
    )
    static let deniedAppealBody = CivicaText(
        "Federal law gives you 90 days from the denial notice to request a fair hearing. Submit your appeal by the deadline on your denial letter — outcomes depend on the reason for denial.",
        es: "La ley federal te da 90 días desde la carta de denegación para solicitar una audiencia justa. Presenta tu apelación antes de la fecha límite indicada en tu carta — el resultado depende del motivo de la denegación.",
        zh: "联邦法律给你从拒绝通知书发出之日起 90 天的时间申请公正听证。请在拒绝信上注明的截止日期之前提交上诉 —— 结果取决于被拒的原因。"
    )

    static let deniedReviewTitle = CivicaText(
        "Review what you submitted",
        es: "Revisa lo que enviaste",
        zh: "查看你提交的内容"
    )
    static let deniedReviewBody = CivicaText(
        "Sometimes a denial comes from a missing document or a number that looked wrong. Look at your application before you appeal.",
        es: "A veces la denegación viene de un documento que falta o un número que parecía incorrecto. Mira tu solicitud antes de apelar.",
        zh: "有时被拒是因为缺少一份文件,或某个数字看起来有误。在上诉之前先看看你的申请。"
    )

    static let deniedFoodHelpTitle = CivicaText(
        "Find food help today",
        es: "Encuentra ayuda con comida hoy",
        zh: "今天就找到食物援助"
    )
    static let deniedFoodHelpBody = CivicaText(
        "Food banks, school meal programs, and community fridges don't require SNAP approval. Most are open to anyone in need.",
        es: "Los bancos de alimentos, programas de comidas escolares y refrigeradores comunitarios no requieren aprobación de SNAP. La mayoría están abiertos a cualquier persona necesitada.",
        zh: "食物银行、学校供餐项目和社区冰箱都不需要 SNAP 批准。大多数对任何有需要的人都开放。"
    )

    static let deniedReapplyTitle = CivicaText(
        "Apply again when something changes",
        es: "Solicita de nuevo cuando algo cambie",
        zh: "情况有变化时再申请一次"
    )
    static let deniedReapplyBody = CivicaText(
        "If your income drops, your household grows, or your expenses go up, you can reapply right away. There's no waiting period.",
        es: "Si tus ingresos bajan, tu hogar crece o tus gastos suben, puedes volver a solicitar de inmediato. No hay un período de espera.",
        zh: "如果你的收入减少、家庭人数增加,或支出上升,你可以立刻重新申请。没有等待期。"
    )

    static let deniedPrimaryActionAppeal = CivicaText(
        "Start an appeal",
        es: "Iniciar una apelación",
        zh: "开始上诉"
    )
    static let deniedSecondaryActionReapply = CivicaText(
        "Start a new application",
        es: "Iniciar una nueva solicitud",
        zh: "开始新的申请"
    )

    // IA-5: confirmation dialog when the user taps the Reapply card.
    // We clear the saved draft, so they need a beat to confirm.
    static let deniedReapplyConfirmTitle = CivicaText(
        "Start a new application?",
        es: "¿Iniciar una nueva solicitud?",
        zh: "开始新的申请吗?"
    )
    static let deniedReapplyConfirmBody = CivicaText(
        "Your previous answers will be cleared. You can pick up the appeal flow any time before the 90-day deadline.",
        es: "Se borrarán tus respuestas anteriores. Puedes retomar la apelación en cualquier momento antes de la fecha límite de 90 días.",
        zh: "你之前的回答会被清除。你可以在 90 天截止日期之前的任何时候继续上诉流程。"
    )
    static let deniedReapplyConfirmAction = CivicaText(
        "Start a new application",
        es: "Iniciar una nueva solicitud",
        zh: "开始新的申请"
    )
    static let deniedReapplyCancelAction = CivicaText(
        "Keep my answers",
        es: "Mantener mis respuestas",
        zh: "保留我的回答"
    )

    // IA-5: Review-what-you-submitted card destination.
    static let deniedReviewPacketTitle = CivicaText(
        "What you submitted",
        es: "Lo que enviaste",
        zh: "你提交的内容"
    )
    static let deniedReviewPacketBody = CivicaText(
        "A read-only copy of the application Civica handed to the county. No changes here — when you're ready to send something new, tap below.",
        es: "Una copia de solo lectura de la solicitud que Civica entregó al condado. Aquí no puedes editar — cuando estés listo para enviar algo nuevo, toca abajo.",
        zh: "这是 Civica 交给县政府的申请的只读副本。这里不能修改 —— 等你准备好提交新内容时,点击下方。"
    )
    static let deniedReviewReapplyCTA = CivicaText(
        "Reapply with these answers",
        es: "Solicitar de nuevo con estas respuestas",
        zh: "使用这些回答重新申请"
    )

    // IA-5: appealability gate copy. Shown on the demoted Appeal card
    // when AppealabilityService.evaluate(...) returns isAppealable=false.
    static let deniedAppealWindowClosed = CivicaText(
        "The 90-day appeal window has closed.",
        es: "Se cerró el plazo de 90 días para apelar.",
        zh: "90 天的上诉窗口已经关闭。"
    )
    static let deniedAppealCategoryExcluded = CivicaText(
        "This kind of denial isn't appealable through a fair hearing.",
        es: "Este tipo de denegación no se puede apelar mediante una audiencia justa.",
        zh: "这类拒绝无法通过公正听证来上诉。"
    )

    // IA-5: when Appeal is demoted, the primary action becomes
    // "Speak with a navigator" — already wired via onOpenExternalPortal
    // for non-denial surfaces. Copy mirrors RecertCompanion's pattern.
    static let deniedPrimaryActionNavigator = CivicaText(
        "Speak with a navigator",
        es: "Hablar con un navegador",
        zh: "和申请顾问通话"
    )

    // MARK: - Recertification surface
    //
    // SNAP recertification: every 12 months for most MA households,
    // 24 months for elderly/disabled. DTA mails the notice ~45 days
    // out. Missing the deadline means benefits stop — the surface
    // has to be urgent without being panic-inducing.

    static let recertTitle = CivicaText(
        "Time to recertify your SNAP",
        es: "Es hora de recertificar tu SNAP",
        zh: "该为你的 SNAP 复审了"
    )
    static func recertBody(stateCode: String?, language: CivicaLanguage) -> String {
        let stateName: String
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA": stateName = language == .english ? "California" : "California"
        case "MA": stateName = language == .english ? "Massachusetts" : "Massachusetts"
        default:   stateName = language == .english ? "your state" : "tu estado"
        }
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Recertification is how \(stateName) checks that you still qualify. It's basically reapplying — most of the questions will look familiar."
        case .mandarin:
            return "复审是 \(stateName) 用来确认你是否仍然符合资格的方式。基本上就是重新申请一次 —— 大部分问题你都会觉得眼熟。"
        case .spanish:
            return "La recertificación es cómo \(stateName) verifica que aún calificas. Básicamente es volver a solicitar — la mayoría de las preguntas te resultarán familiares."
        }
    }

    /// "Due May 28, 2026" / "Vence el 28 de mayo de 2026". Localized
    /// medium-date formatting via DateFormatter on the caller side;
    /// this just slots the date into the surrounding phrase.
    static func recertDueLine(formattedDate: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Due by \(formattedDate)"
        case .mandarin: return "截止日期:\(formattedDate)"
        case .spanish: return "Vence el \(formattedDate)"
        }
    }
    static let recertDueSoon = CivicaText(
        "Due soon",
        es: "Vence pronto",
        zh: "即将到期"
    )

    static let recertWhyMattersHeading = CivicaText(
        "Why this matters",
        es: "Por qué importa esto",
        zh: "为什么这很重要"
    )
    static let recertWhyMattersBody = CivicaText(
        "If you miss the deadline, your benefits stop on the last day of the month. You'd need to apply from scratch to get them back.",
        es: "Si no cumples con la fecha límite, tus beneficios terminan el último día del mes. Tendrías que solicitar desde cero para recuperarlos.",
        zh: "如果错过截止日期,你的补助会在当月最后一天停止。要恢复就得从头重新申请。"
    )

    static let recertWhatYoullNeedHeading = CivicaText(
        "What you'll need",
        es: "Lo que necesitarás",
        zh: "你需要准备的"
    )
    static let recertNeedIncome = CivicaText(
        "Recent paystubs or proof of income",
        es: "Talones de pago recientes o prueba de ingresos",
        zh: "近期工资单或收入证明"
    )
    static let recertNeedHousehold = CivicaText(
        "Anyone who joined or left the household",
        es: "Cualquier persona que se haya unido o salido del hogar",
        zh: "搬入或搬出家庭的任何人"
    )
    static let recertNeedExpenses = CivicaText(
        "Updated rent, utilities, or medical expenses",
        es: "Renta, servicios o gastos médicos actualizados",
        zh: "更新后的房租、水电费或医疗支出"
    )
    static let recertNeedAddress = CivicaText(
        "Proof of address if you moved",
        es: "Prueba de domicilio si te mudaste",
        zh: "如果你搬过家,需要地址证明"
    )

    static let recertPrimaryAction = CivicaText(
        "Start your recertification",
        es: "Comienza tu recertificación",
        zh: "开始你的复审"
    )
    /// "Open <portal>" — was `recertSecondaryOpenDTA` pre-CA-launch;
    /// now state-aware so recert callouts route to the active state's
    /// apply portal. Symbol name kept for caller-search continuity.
    static func recertSecondaryOpenPortal(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalLabel = portal.isEmpty ? "your state portal" : portal
        switch language {
        case .english, .vietnamese, .tagalog: return "Open \(portalLabel)"
        case .mandarin: return "打开 \(portalLabel)"
        case .spanish: return "Abrir \(portalLabel)"
        }
    }

    // MARK: - FindHelp integration callouts
    //
    // The map module already exists in Civica/Features/SNAP/FindHelp.
    // These strings drive deep-links from the status surfaces (denial,
    // waiting room, recert) into the map with a pre-applied filter
    // — food assistance vs SNAP application help.

    static let findHelpFoodLinkTitle = CivicaText(
        "See food help on the map",
        es: "Ver ayuda con comida en el mapa",
        zh: "在地图上查看食物援助"
    )
    static let findHelpFoodLinkSubtitle = CivicaText(
        "Food banks, pantries, and community fridges near you. No SNAP approval required.",
        es: "Bancos de alimentos, despensas y refrigeradores comunitarios cerca de ti. No requieren aprobación de SNAP.",
        zh: "你附近的食物银行、食物分发点和社区冰箱。无需 SNAP 批准。"
    )

    static let findHelpApplicationLinkTitle = CivicaText(
        "Get help with your application",
        es: "Recibe ayuda con tu solicitud",
        zh: "获取申请方面的帮助"
    )
    static let findHelpApplicationLinkSubtitle = CivicaText(
        "Local SNAP navigators and community organizations who can help in person or on the phone.",
        es: "Asesores locales de SNAP y organizaciones comunitarias que pueden ayudarte en persona o por teléfono.",
        zh: "当地的 SNAP 申请顾问和社区组织,可以当面或电话提供帮助。"
    )
}
