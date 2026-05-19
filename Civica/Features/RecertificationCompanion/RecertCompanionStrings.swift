import Foundation

// User-visible strings for the Recertification Companion module.
// EN + ES at full parity. Pattern follows OnboardingStrings /
// CivicaEntryStrings — each logical string is a CivicaText instance,
// looked up via `.value(in: language)` at the call site.

enum RecertCompanionStrings {
    // MARK: - Home / dashboard

    static let homeTitle = CivicaText(
        "Recertification Companion",
        es: "Acompañante de recertificación"
    )
    static let homeSubtitle = CivicaText(
        "Stay ahead of your next SNAP recertification.",
        es: "Adelántate a tu próxima recertificación de SNAP."
    )

    static let recertDateLabel = CivicaText(
        "Your next recert",
        es: "Tu próxima recertificación"
    )
    static let editDateAction = CivicaText(
        "Edit date",
        es: "Editar fecha"
    )

    static let unknownDate = CivicaText(
        "Date not set",
        es: "Fecha no establecida"
    )

    // MARK: - Phantom Recert (Feature 1)

    static let phantomEntryTitle = CivicaText(
        "Walk through your recert early",
        es: "Practica tu recertificación con tiempo"
    )
    static let phantomEntrySubtitle = CivicaText(
        "A complete dry run — no submission. About 5 minutes.",
        es: "Una práctica completa — sin enviar. Unos 5 minutos."
    )
    static let phantomEntryCTA = CivicaText(
        "Start dry run",
        es: "Comenzar práctica"
    )

    static let phantomSummaryTitle = CivicaText(
        "You're ready for recert",
        es: "Estás listo para recertificar"
    )
    static let phantomSummarySubtitle = CivicaText(
        "Here's a fresh estimate, what's changed, and what to gather before the real recert.",
        es: "Aquí tienes una estimación nueva, qué ha cambiado y qué reunir antes de la recertificación real."
    )
    static let phantomChangesHeader = CivicaText(
        "Since your last recert",
        es: "Desde tu última recertificación"
    )
    static let phantomChecklistHeader = CivicaText(
        "Before the real recert",
        es: "Antes de la recertificación real"
    )
    static let phantomCloseCTA = CivicaText(
        "I'll come back later",
        es: "Vuelvo más tarde"
    )
    static let phantomStartRealCTA = CivicaText(
        "Start the real recert",
        es: "Comenzar recertificación real"
    )

    // MARK: - Expiration Calendar (Feature 2)

    static let calendarHeader = CivicaText(
        "Documents to refresh",
        es: "Documentos a actualizar"
    )
    static let calendarEmptyState = CivicaText(
        "Nothing to refresh right now. We'll let you know when something needs an update.",
        es: "Nada que actualizar por ahora. Te avisaremos cuando algo necesite renovarse."
    )
    static let actionReplace = CivicaText(
        "Replace",
        es: "Reemplazar"
    )
    static let actionDueBy = CivicaText(
        "By",
        es: "Para"
    )

    // MARK: - Reminders (Feature 3)

    static let reminderPermissionTitle = CivicaText(
        "Let us nudge you on the right day",
        es: "Permítenos avisarte el día correcto"
    )
    static let reminderPermissionSubtitle = CivicaText(
        "We send one notification per document, only when it's the right time to upload a fresh one. No promotions, no nags.",
        es: "Enviamos una notificación por documento, solo cuando es el momento adecuado para subir una nueva. Sin promociones, sin insistencia."
    )
    static let reminderPermissionAccept = CivicaText(
        "Allow reminders",
        es: "Permitir recordatorios"
    )
    static let reminderPermissionSkip = CivicaText(
        "Not now",
        es: "Ahora no"
    )

    // MARK: - Interview Coach (Feature 5)

    static let interviewCoachEntryTitle = CivicaText(
        "Practice your interview",
        es: "Practica tu entrevista"
    )
    static let interviewCoachEntrySubtitle = CivicaText(
        "8 min · voice or text",
        es: "8 min · voz o texto"
    )
    static let interviewCoachEntryCTA = CivicaText(
        "Start",
        es: "Comenzar"
    )

    // MARK: - Appeal (Feature 4)

    static let appealEntryTitle = CivicaText(
        "Your case was denied. You can appeal.",
        es: "Tu caso fue denegado. Puedes apelar."
    )
    static let appealEntrySubtitle = CivicaText(
        "Most procedural denials are reversed at fair hearing. We'll draft your request — you review and send.",
        es: "La mayoría de las denegaciones por procedimiento se revierten en una audiencia justa. Redactaremos tu solicitud — tú la revisas y envías."
    )
    static let appealEntryCTA = CivicaText(
        "Start an appeal",
        es: "Iniciar apelación"
    )

    static let appealReviewHeader = CivicaText(
        "Review your appeal",
        es: "Revisa tu apelación"
    )
    static let appealEditCTA = CivicaText(
        "Edit text",
        es: "Editar texto"
    )
    static let appealExportPDF = CivicaText(
        "Save as PDF",
        es: "Guardar como PDF"
    )
    static let appealOpenStatePortal = CivicaText(
        "Open state portal",
        es: "Abrir portal estatal"
    )

    static let denialReasonMissedInterview = CivicaText(
        "Missed interview",
        es: "Entrevista perdida"
    )
    static let denialReasonMissingDocuments = CivicaText(
        "Missing documents",
        es: "Documentos faltantes"
    )
    static let denialReasonNoResponse = CivicaText(
        "No response to the agency",
        es: "Sin respuesta a la agencia"
    )
    static let denialReasonOther = CivicaText(
        "Other procedural reason",
        es: "Otro motivo de procedimiento"
    )

    static let scanDenialLetterCTA = CivicaText(
        "Scan the denial letter",
        es: "Escanear la carta de denegación"
    )
    static let enterManuallyCTA = CivicaText(
        "Enter the details yourself",
        es: "Ingresa los detalles tú mismo"
    )
}
