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
    static let waitingBody = CivicaText(
        "Your application is with Massachusetts DTA. Most decisions take 7–30 days. We'll let you know when something changes.",
        es: "Tu solicitud está con el DTA de Massachusetts. La mayoría de las decisiones tardan de 7 a 30 días. Te avisaremos cuando algo cambie."
    )
    static let waitingExpedited = CivicaText(
        "You may qualify for expedited service. DTA decides this within 7 days.",
        es: "Puedes calificar para servicio expedito. El DTA decide esto dentro de 7 días."
    )

    // MARK: - Action chips / next step prompts

    static let actionGeneratePacket = CivicaText(
        "Generate your application packet",
        es: "Genera tu paquete de solicitud"
    )
    static let actionSubmitToState = CivicaText(
        "Submit to DTA Connect",
        es: "Envía a DTA Connect"
    )
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
    static let stepSubmit = CivicaText(
        "Submit to DTA Connect",
        es: "Envíalo a DTA Connect"
    )
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
    static let deniedBody = CivicaText(
        "Massachusetts DTA decided you don't qualify right now. You have options — denials are not the end of the road.",
        es: "El DTA de Massachusetts decidió que no calificas en este momento. Tienes opciones — una denegación no es el final del camino."
    )
    static let deniedReasonHeading = CivicaText(
        "What the state told us",
        es: "Lo que nos dijo el estado"
    )
    static let deniedReasonMissing = CivicaText(
        "The state hasn't shared a specific reason with Civica yet. Check your DTA Connect inbox or the denial notice you received in the mail.",
        es: "El estado todavía no ha compartido una razón específica con Civica. Revisa tu bandeja de DTA Connect o la carta de denegación que recibiste por correo."
    )

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
        "Federal law gives you 90 days from the denial notice to ask the state to review the decision. You can win — many denials are reversed.",
        es: "La ley federal te da 90 días desde la carta de denegación para pedir al estado que revise la decisión. Puedes ganar — muchas denegaciones se revierten."
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
}
