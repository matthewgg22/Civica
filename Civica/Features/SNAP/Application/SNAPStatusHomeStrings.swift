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
}
