import Foundation

// Strings for HANDOFF boards 11 (status home), 12 (returning user
// home), and 24 (the waiting room). Every visible string keyed for
// English + Spanish per HANDOFF #4 Spanish parity gate.

enum SNAPStatusHomeStrings {

    // MARK: - Returning user home (board 12)

    static let returningWelcome = CivicaText(
        "Welcome back",
        es: "Bienvenido de nuevo"
    )
    static let returningSubtitle = CivicaText(
        "Here's where your SNAP application stands.",
        es: "Aquí está el estado de tu solicitud de SNAP."
    )
    static let returningResume = CivicaText(
        "Continue where you left off",
        es: "Continuar donde lo dejaste"
    )
    static let returningStartOver = CivicaText(
        "Start over",
        es: "Empezar de nuevo"
    )

    // MARK: - Waiting room (board 24)

    static let waitingTitle = CivicaText(
        "What's happening now",
        es: "Qué está pasando ahora"
    )
    static func waitingBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return "Your application is with \(agency). Most decisions take 7–30 days. We'll let you know when something changes."
        case .spanish:
            return "Tu solicitud está con \(agency). La mayoría de las decisiones tardan de 7 a 30 días. Te avisaremos cuando algo cambie."
        }
    }
    // MARK: - Action chips / next step prompts

    static let actionGeneratePacket = CivicaText(
        "Generate your application packet",
        es: "Genera tu paquete de solicitud"
    )
    /// Link-out CTA: "Open <portal> to submit". Per OBBBA Q14, the
    /// "Submit to <portal>" framing is banned (implies a Civica->state
    /// write integration without written authorization); the
    /// "Open <portal> to submit" framing is the approved fallback.
    static func actionSubmitToState(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalLabel = portal.isEmpty ? "your state portal" : portal
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Open \(portalLabel) to submit"
        case .spanish: return "Abrir \(portalLabel) para enviar"
        }
    }
    static let actionUploadRequested = CivicaText(
        "Upload requested documents",
        es: "Sube los documentos solicitados"
    )
    static let actionPrepareInterview = CivicaText(
        "Prepare for your interview",
        es: "Prepárate para tu entrevista"
    )
    static let actionViewDecision = CivicaText(
        "View your decision",
        es: "Ver tu decisión"
    )
    static let actionRecert = CivicaText(
        "Start your recertification",
        es: "Comienza tu recertificación"
    )

    // MARK: - Timeline step labels

    static let stepScreener = CivicaText(
        "Eligibility screener",
        es: "Evaluación de elegibilidad"
    )
    static let stepPacket = CivicaText(
        "Application packet generated",
        es: "Paquete de solicitud generado"
    )
    /// Timeline-step label that mirrors `actionSubmitToState`.
    static func stepSubmit(stateCode: String?, language: CivicaLanguage) -> String {
        actionSubmitToState(stateCode: stateCode, language: language)
    }
    static let stepStateAcknowledged = CivicaText(
        "State received your application",
        es: "El estado recibió tu solicitud"
    )
    static let stepDocuments = CivicaText(
        "Documents requested",
        es: "Documentos solicitados"
    )
    static let stepInterview = CivicaText(
        "Phone interview",
        es: "Entrevista telefónica"
    )
    static let stepDecision = CivicaText(
        "Decision",
        es: "Decisión"
    )

    // MARK: - Detail lines under timeline steps

    static let detailEstimatedBenefit = CivicaText(
        "Estimated benefit: %@",
        es: "Beneficio estimado: %@"
    )

    static func estimatedBenefit(amountText: String, language: CivicaLanguage) -> String {
        detailEstimatedBenefit.value(in: language)
            .replacingOccurrences(of: "%@", with: amountText)
    }

    // MARK: - Status indicators

    static let statusComplete = CivicaText("Complete", es: "Completado")
    static let statusInProgress = CivicaText("In progress", es: "En curso")
    static let statusActionNeeded = CivicaText("Action needed", es: "Acción necesaria")
    static let statusWaiting = CivicaText("Waiting", es: "En espera")

    // MARK: - Denial surface (board 23 · denial path)
    //
    // Brand voice rule: honest acknowledgment, no fabricated optimism,
    // no "we're working hard for you" filler. Every line below names
    // a real next step the user can act on today.

    static let deniedTitle = CivicaText(
        "Your SNAP application was denied",
        es: "Tu solicitud de SNAP fue denegada"
    )
    static func deniedBody(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return "\(agency) decided you don't qualify right now. You have options — denials are not the end of the road."
        case .spanish:
            return "\(agency) decidió que no calificas en este momento. Tienes opciones — una denegación no es el final del camino."
        }
    }
    static let deniedReasonHeading = CivicaText(
        "What the state told us",
        es: "Lo que nos dijo el estado"
    )
    static func deniedReasonMissing(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalRef = portal.isEmpty ? "your state portal" : portal
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return "The state hasn't shared a specific reason with Civica yet. Check your \(portalRef) inbox or the denial notice you received in the mail."
        case .spanish:
            return "El estado todavía no ha compartido una razón específica con Civica. Revisa tu bandeja de \(portalRef) o la carta de denegación que recibiste por correo."
        }
    }

    static let deniedNextStepsHeading = CivicaText(
        "What you can do next",
        es: "Qué puedes hacer ahora"
    )

    // Appeal — 90-day fair hearing right is federal (7 CFR 273.15).
    static let deniedAppealTitle = CivicaText(
        "Request a fair hearing",
        es: "Solicitar una audiencia justa"
    )
    static let deniedAppealBody = CivicaText(
        "Federal law gives you 90 days from the denial notice to request a fair hearing. Submit your appeal by the deadline on your denial letter — outcomes depend on the reason for denial.",
        es: "La ley federal te da 90 días desde la carta de denegación para solicitar una audiencia justa. Presenta tu apelación antes de la fecha límite indicada en tu carta — el resultado depende del motivo de la denegación."
    )

    static let deniedReviewTitle = CivicaText(
        "Review what you submitted",
        es: "Revisa lo que enviaste"
    )
    static let deniedReviewBody = CivicaText(
        "Sometimes a denial comes from a missing document or a number that looked wrong. Look at your application before you appeal.",
        es: "A veces la denegación viene de un documento que falta o un número que parecía incorrecto. Mira tu solicitud antes de apelar."
    )

    static let deniedFoodHelpTitle = CivicaText(
        "Find food help today",
        es: "Encuentra ayuda con comida hoy"
    )
    static let deniedFoodHelpBody = CivicaText(
        "Food banks, school meal programs, and community fridges don't require SNAP approval. Most are open to anyone in need.",
        es: "Los bancos de alimentos, programas de comidas escolares y refrigeradores comunitarios no requieren aprobación de SNAP. La mayoría están abiertos a cualquier persona necesitada."
    )

    static let deniedReapplyTitle = CivicaText(
        "Apply again when something changes",
        es: "Solicita de nuevo cuando algo cambie"
    )
    static let deniedReapplyBody = CivicaText(
        "If your income drops, your household grows, or your expenses go up, you can reapply right away. There's no waiting period.",
        es: "Si tus ingresos bajan, tu hogar crece o tus gastos suben, puedes volver a solicitar de inmediato. No hay un período de espera."
    )

    static let deniedPrimaryActionAppeal = CivicaText(
        "Start an appeal",
        es: "Iniciar una apelación"
    )
    static let deniedSecondaryActionReapply = CivicaText(
        "Start a new application",
        es: "Iniciar una nueva solicitud"
    )

    // IA-5: confirmation dialog when the user taps the Reapply card.
    // We clear the saved draft, so they need a beat to confirm.
    static let deniedReapplyConfirmTitle = CivicaText(
        "Start a new application?",
        es: "¿Iniciar una nueva solicitud?"
    )
    static let deniedReapplyConfirmBody = CivicaText(
        "Your previous answers will be cleared. You can pick up the appeal flow any time before the 90-day deadline.",
        es: "Se borrarán tus respuestas anteriores. Puedes retomar la apelación en cualquier momento antes de la fecha límite de 90 días."
    )
    static let deniedReapplyConfirmAction = CivicaText(
        "Start a new application",
        es: "Iniciar una nueva solicitud"
    )
    static let deniedReapplyCancelAction = CivicaText(
        "Keep my answers",
        es: "Mantener mis respuestas"
    )

    // IA-5: Review-what-you-submitted card destination.
    static let deniedReviewPacketTitle = CivicaText(
        "What you submitted",
        es: "Lo que enviaste"
    )
    static let deniedReviewPacketBody = CivicaText(
        "A read-only copy of the application Civica handed to the county. No changes here — when you're ready to send something new, tap below.",
        es: "Una copia de solo lectura de la solicitud que Civica entregó al condado. Aquí no puedes editar — cuando estés listo para enviar algo nuevo, toca abajo."
    )
    static let deniedReviewReapplyCTA = CivicaText(
        "Reapply with these answers",
        es: "Solicitar de nuevo con estas respuestas"
    )

    // IA-5: appealability gate copy. Shown on the demoted Appeal card
    // when AppealabilityService.evaluate(...) returns isAppealable=false.
    static let deniedAppealWindowClosed = CivicaText(
        "The 90-day appeal window has closed.",
        es: "Se cerró el plazo de 90 días para apelar."
    )
    static let deniedAppealCategoryExcluded = CivicaText(
        "This kind of denial isn't appealable through a fair hearing.",
        es: "Este tipo de denegación no se puede apelar mediante una audiencia justa."
    )

    // IA-5: when Appeal is demoted, the primary action becomes
    // "Speak with a navigator" — already wired via onOpenExternalPortal
    // for non-denial surfaces. Copy mirrors RecertCompanion's pattern.
    static let deniedPrimaryActionNavigator = CivicaText(
        "Speak with a navigator",
        es: "Hablar con un navegador"
    )

    // MARK: - Recertification surface
    //
    // SNAP recertification: every 12 months for most MA households,
    // 24 months for elderly/disabled. DTA mails the notice ~45 days
    // out. Missing the deadline means benefits stop — the surface
    // has to be urgent without being panic-inducing.

    static let recertTitle = CivicaText(
        "Time to recertify your SNAP",
        es: "Es hora de recertificar tu SNAP"
    )
    static func recertBody(stateCode: String?, language: CivicaLanguage) -> String {
        let stateName: String
        switch (stateCode ?? SNAPAgencyDirectory.launchStateCode).uppercased() {
        case "CA": stateName = language == .english ? "California" : "California"
        case "MA": stateName = language == .english ? "Massachusetts" : "Massachusetts"
        default:   stateName = language == .english ? "your state" : "tu estado"
        }
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog:
            return "Recertification is how \(stateName) checks that you still qualify. It's basically reapplying — most of the questions will look familiar."
        case .spanish:
            return "La recertificación es cómo \(stateName) verifica que aún calificas. Básicamente es volver a solicitar — la mayoría de las preguntas te resultarán familiares."
        }
    }

    /// "Due May 28, 2026" / "Vence el 28 de mayo de 2026". Localized
    /// medium-date formatting via DateFormatter on the caller side;
    /// this just slots the date into the surrounding phrase.
    static func recertDueLine(formattedDate: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Due by \(formattedDate)"
        case .spanish: return "Vence el \(formattedDate)"
        }
    }
    static let recertDueSoon = CivicaText(
        "Due soon",
        es: "Vence pronto"
    )

    static let recertWhyMattersHeading = CivicaText(
        "Why this matters",
        es: "Por qué importa esto"
    )
    static let recertWhyMattersBody = CivicaText(
        "If you miss the deadline, your benefits stop on the last day of the month. You'd need to apply from scratch to get them back.",
        es: "Si no cumples con la fecha límite, tus beneficios terminan el último día del mes. Tendrías que solicitar desde cero para recuperarlos."
    )

    static let recertWhatYoullNeedHeading = CivicaText(
        "What you'll need",
        es: "Lo que necesitarás"
    )
    static let recertNeedIncome = CivicaText(
        "Recent paystubs or proof of income",
        es: "Talones de pago recientes o prueba de ingresos"
    )
    static let recertNeedHousehold = CivicaText(
        "Anyone who joined or left the household",
        es: "Cualquier persona que se haya unido o salido del hogar"
    )
    static let recertNeedExpenses = CivicaText(
        "Updated rent, utilities, or medical expenses",
        es: "Renta, servicios o gastos médicos actualizados"
    )
    static let recertNeedAddress = CivicaText(
        "Proof of address if you moved",
        es: "Prueba de domicilio si te mudaste"
    )

    static let recertPrimaryAction = CivicaText(
        "Start your recertification",
        es: "Comienza tu recertificación"
    )
    /// "Open <portal>" — was `recertSecondaryOpenDTA` pre-CA-launch;
    /// now state-aware so recert callouts route to the active state's
    /// apply portal. Symbol name kept for caller-search continuity.
    static func recertSecondaryOpenPortal(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalLabel = portal.isEmpty ? "your state portal" : portal
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Open \(portalLabel)"
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
        es: "Ver ayuda con comida en el mapa"
    )
    static let findHelpFoodLinkSubtitle = CivicaText(
        "Food banks, pantries, and community fridges near you. No SNAP approval required.",
        es: "Bancos de alimentos, despensas y refrigeradores comunitarios cerca de ti. No requieren aprobación de SNAP."
    )

    static let findHelpApplicationLinkTitle = CivicaText(
        "Get help with your application",
        es: "Recibe ayuda con tu solicitud"
    )
    static let findHelpApplicationLinkSubtitle = CivicaText(
        "Local SNAP navigators and community organizations who can help in person or on the phone.",
        es: "Asesores locales de SNAP y organizaciones comunitarias que pueden ayudarte en persona o por teléfono."
    )
}
