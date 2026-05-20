import Foundation

// Strings for all Marketplace screens (01–06) — English + Spanish parity
// per HANDOFF #4 gate. Each entry corresponds to a raw user-facing literal
// that would otherwise bypass CivicaText and break the ES parity check.

enum SNAPMarketplaceStrings {

    // MARK: - SNAPJobsView (Screen 02)

    static let jobsNavTitle = CivicaText(
        "Jobs for you",
        es: "Empleos para ti"
    )
    static let openHoursPrefix = CivicaText(
        "Open hours: ",
        es: "Horario: "
    )
    static let incomeCapPrefix = CivicaText(
        "Income cap: $",
        es: "Límite de ingresos: $"
    )
    static let incomeCapSuffix = CivicaText(
        "/mo before benefit changes",
        es: "/mes antes de cambios en el beneficio"
    )
    static let showMore = CivicaText(
        "Show more",
        es: "Ver más"
    )
    static let filter = CivicaText(
        "Filter",
        es: "Filtrar"
    )

    // MARK: - SNAPRecertRefreshView (Screen 06)

    static let recertNavTitle = CivicaText(
        "Recertify",
        es: "Recertificar"
    )
    static let packetReady = CivicaText(
        "Most of your packet is ready",
        es: "La mayor parte de tu expediente está listo"
    )
    static let practiceInterview = CivicaText(
        "Practice your county interview",
        es: "Practica tu entrevista del condado"
    )
    static let interviewDuration = CivicaText(
        "8 min · voice or text",
        es: "8 min · voz o texto"
    )
    static let startButton = CivicaText(
        "Start",
        es: "Comenzar"
    )

    // MARK: - SNAPApplyHandoffView (Screen 04)

    static let applyNavTitle = CivicaText(
        "Apply",
        es: "Solicitar"
    )
    static let applyHeroHeadline = CivicaText(
        "Apply to Dining Services through Handshake",
        es: "Solicita en Dining Services a través de Handshake"
    )
    static let handshakeIntro = CivicaText(
        "Handshake is your campus's official jobs platform. Civica passes your verified income and class schedule so you don't re-enter them.",
        es: "Handshake es la plataforma oficial de empleos de tu campus. Civica compartirá tu resumen de elegibilidad laboral para que tu solicitud esté prellenada."
    )
    static let notSharedNote = CivicaText(
        "Handshake will see only what's needed for your application. Civica does not share your benefit amount.",
        es: "Handshake solo verá lo necesario para tu solicitud, no tu estado de SNAP ni tus ingresos."
    )
    static let continueTo = CivicaText(
        "Continue to ",
        es: "Continuar a "
    )
    // Proper noun — identical in both languages
    static let handshakeBrand = CivicaText(
        "Handshake",
        es: "Handshake"
    )
    // Directional arrow glyph — language-neutral decorative suffix
    static let arrowSuffix = CivicaText(
        " \u{2192}",
        es: " \u{2192}"
    )
    // Preview-only label
    static let tapToOpenSheet = CivicaText(
        "Tap to open sheet",
        es: "Toca para abrir"
    )
    // Screen 04 shared-data card row labels
    static let sharedRowPlaid = CivicaText(
        "Income verified by Plaid",
        es: "Ingresos verificados por Plaid"
    )
    static let sharedRowCanvas = CivicaText(
        "Class schedule from Canvas",
        es: "Horario de clases de Canvas"
    )
    static let sharedRowSnapEligible = CivicaText(
        "SNAP-eligible status confirmed",
        es: "Estado elegible para SNAP confirmado"
    )
    // Screen 04 disconnected-source state (D5)
    static let reconnect = CivicaText(
        "Reconnect",
        es: "Reconectar"
    )
    static let disconnectedSource = CivicaText(
        "Not connected",
        es: "No conectado"
    )

    // MARK: - SNAPPlacementUpdateView (Screen 05)

    static let updateNavTitle = CivicaText(
        "Update",
        es: "Actualización"
    )
    static let diningServicesPrefix = CivicaText(
        "Dining Services · $",
        es: "Dining Services · $"
    )
    static let firstPaycheck = CivicaText(
        "(first paycheck)",
        es: "(primer cheque)"
    )
    static let confirmedViaPrefix = CivicaText(
        "Confirmed via ",
        es: "Confirmado mediante "
    )
    static let confirmedViaSuffix = CivicaText(
        " from your direct deposit.",
        es: " de tu depósito directo."
    )
    static let yourBenefitEstimate = CivicaText(
        "YOUR BENEFIT ESTIMATE",
        es: "TU ESTIMACIÓN DE BENEFICIO"
    )
    static let was = CivicaText(
        "WAS",
        es: "ERA"
    )
    static let now = CivicaText(
        "NOW",
        es: "AHORA"
    )
    static let countyNotified = CivicaText(
        "Your county worker has been notified. No action needed.",
        es: "Tu trabajador del condado ha sido notificado. No se necesita ninguna acción."
    )
    static let obbbaWorkHourLog = CivicaText(
        "OBBBA WORK-HOUR LOG",
        es: "REGISTRO DE HORAS OBBBA"
    )
    // " of X hours" split into prefix (" of ") + suffix (" hours") so the
    // interpolated count can be inserted between them in the view.
    static let ofPrefix = CivicaText(
        " of ",
        es: " de "
    )
    static let hoursSuffix = CivicaText(
        " hours",
        es: " horas"
    )
    static let autoCountsNote = CivicaText(
        "Civica auto-counts hours from your verified employer. No timesheet to submit.",
        es: "Civica cuenta automáticamente las horas de tu empleador verificado. No se necesita entrada manual."
    )

    // MARK: - SNAPEnrolledView (Screen 01)

    static let enrolledNavTitle = CivicaText(
        "You're enrolled",
        es: "Estás inscrito/a"
    )
    // Screen 01 error inline block (D3)
    static let benefitLoadErrorHeadline = CivicaText(
        "Couldn't load your benefit",
        es: "No se pudo cargar tu beneficio"
    )
    static let benefitLoadErrorBody = CivicaText(
        "Check your connection and try again.",
        es: "Verifica tu conexión e inténtalo de nuevo."
    )
    static let retry = CivicaText(
        "Try again",
        es: "Intentar de nuevo"
    )
    static let enrolledHeadline = CivicaText(
        "You're enrolled in SNAP",
        es: "Estás inscrito/a en SNAP"
    )
    static let monthlyBenefit = CivicaText(
        "MONTHLY BENEFIT",
        es: "BENEFICIO MENSUAL"
    )
    static let earnUpTo = CivicaText(
        "Earn up to $1,580/month and keep your full benefit",
        es: "Gana hasta $1,580/mes y conserva tu beneficio completo"
    )
    static let whatsNextBody = CivicaText(
        "We'll show you campus jobs that work around your classes, with the income impact already calculated.",
        es: "Te mostraremos empleos en el campus que se adapten a tus clases, conserven tu beneficio SNAP completo y cuenten como horas de trabajo OBBBA."
    )

    // MARK: - SNAPJobImpactView (Screen 03)

    static let campusSuffix = CivicaText(
        " · Campus",
        es: " · Campus"
    )
    static let hrPerWk = CivicaText(
        " hr/wk · $",
        es: " hr/semana · $"
    )
    static let hrRate = CivicaText(
        "/hr · ",
        es: "/hora · "
    )
    static let plusWeekends = CivicaText(
        " + weekends",
        es: " + fines de semana"
    )
    static let fwsExclusion = CivicaText(
        "FWS earnings would be $0 in this calculation — they're excluded by federal rule 7\u{00A0}CFR\u{00A0}273.9(c)(3).",
        es: "Los ingresos de FWS serían $0 en este cálculo, ya que están excluidos de la prueba de ingresos de SNAP según las reglas federales (7\u{00A0}CFR\u{00A0}273.9(c)(3))."
    )
    // Hardcoded demo value — passthrough (same in both languages)
    static let demoTotalIncome = CivicaText(
        "$1,393/month",
        es: "$1,393/mes"
    )
    static let totalIncomeSuffix = CivicaText(
        " total income — $315 more than benefit alone.",
        es: " de ingresos totales — $315 más que solo el beneficio."
    )
    static let footnoteEstimate = CivicaText(
        "Estimate based on your household of 2 and current shelter cost. Civica updates it monthly when you submit pay stubs.",
        es: "Estimación basada en tu hogar de 2 personas y la deducción de vivienda actual."
    )
    // Screen 03 partial-error accessibility labels (D4)
    static let amountUnavailable = CivicaText(
        "Amount unavailable",
        es: "Cantidad no disponible"
    )
    static let totalIncomeUnavailable = CivicaText(
        "Total income unavailable",
        es: "Ingresos totales no disponibles"
    )
}
