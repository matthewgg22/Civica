import Foundation

// Strings for WorkHoursLogView + AddWorkSessionSheet — English + Spanish parity.

enum WorkHoursStrings {

    // MARK: - Main screen

    static let pageTitle = CivicaText(
        "Work Hours Log",
        es: "Registro de horas laborales"
    )

    static let monthlyProgressHeader = CivicaText(
        "This Month's Progress",
        es: "Progreso de este mes"
    )

    static let hoursOf = CivicaText(
        "hrs of 80 required",
        es: "hrs de 80 requeridas"
    )

    static let statusOnTrack = CivicaText(
        "On Track",
        es: "En camino"
    )

    static let statusAtRisk = CivicaText(
        "At Risk",
        es: "En riesgo"
    )

    static let statusComplete = CivicaText(
        "Complete",
        es: "Completado"
    )

    static let noSessionsYet = CivicaText(
        "No sessions logged yet",
        es: "Aún no hay sesiones registradas"
    )

    static let noSessionsSubtitle = CivicaText(
        "Tap the button below to log your first work session.",
        es: "Toca el botón de abajo para registrar tu primera sesión de trabajo."
    )

    static let addSession = CivicaText(
        "Log Work Session",
        es: "Registrar sesión de trabajo"
    )

    static let sessionsThisMonth = CivicaText(
        "Sessions This Month",
        es: "Sesiones este mes"
    )

    static let documentBadge = CivicaText(
        "Doc attached",
        es: "Doc. adjunto"
    )

    static let loadingError = CivicaText(
        "Could not load your work hours.",
        es: "No se pudieron cargar tus horas laborales."
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo"
    )

    // MARK: - Written notice (7 CFR 273.7(g))

    static let noticeTitle = CivicaText(
        "Work Requirement Notice",
        es: "Aviso de requisito laboral"
    )

    static let noticeBody = CivicaText(
        "Because you are between 18 and 64 years old and do not have a child under 14 in your household, you must work, volunteer, or participate in a qualifying activity for at least 20 hours per week or 80 hours per month to keep your CalFresh benefits (7 CFR 273.24, CF 886).",
        es: "Porque tienes entre 18 y 64 años y no tienes un hijo menor de 14 años en tu hogar, debes trabajar, hacer voluntariado o participar en una actividad calificada al menos 20 horas por semana o 80 horas al mes para conservar tus beneficios de CalFresh (7 CFR 273.24, CF 886)."
    )

    static let noticeConsequence = CivicaText(
        "If your hours drop below 20 per week (or 80 per month), contact your county within 10 days — by phone, in person, or via BenefitsCal. No specific form is required (7 CFR 273.12(c)).",
        es: "Si tus horas bajan de 20 por semana (o 80 al mes), comunícate con tu condado en un plazo de 10 días — por teléfono, en persona o a través de BenefitsCal. No se requiere ningún formulario específico (7 CFR 273.12(c))."
    )

    static let noticeAcknowledge = CivicaText(
        "I understand",
        es: "Entiendo"
    )

    // MARK: - Add session sheet

    static let addSheetTitle = CivicaText(
        "Log Work Session",
        es: "Registrar sesión de trabajo"
    )

    static let dateLabel = CivicaText(
        "Date",
        es: "Fecha"
    )

    static let hoursLabel = CivicaText(
        "Hours",
        es: "Horas"
    )

    static let activityTypeLabel = CivicaText(
        "Activity Type",
        es: "Tipo de actividad"
    )

    static let employerLabel = CivicaText(
        "Employer / Organization (optional)",
        es: "Empleador / Organización (opcional)"
    )

    static let notesLabel = CivicaText(
        "Notes (optional)",
        es: "Notas (opcional)"
    )

    static let attachPaystub = CivicaText(
        "Attach Pay Stub or Employer Letter",
        es: "Adjuntar talón de pago o carta de empleador"
    )

    static let attachPaystubSubtitle = CivicaText(
        "Pay stubs and employer letters are commonly accepted. Gig workers (Uber, DoorDash, etc.) may use platform earnings statements — contact your county to confirm what they accept.",
        es: "Los talones de pago y cartas de empleador son comúnmente aceptados. Los trabajadores de plataformas digitales (Uber, DoorDash, etc.) pueden usar estados de ganancias de la plataforma — comunícate con tu condado para confirmar lo que aceptan."
    )

    static let docAttached = CivicaText(
        "Document attached",
        es: "Documento adjunto"
    )

    static let saveSession = CivicaText(
        "Save Session",
        es: "Guardar sesión"
    )

    static let savingSession = CivicaText(
        "Saving…",
        es: "Guardando…"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar"
    )

    static let hoursPlaceholder = CivicaText(
        "e.g. 8",
        es: "p. ej. 8"
    )

    static let saveError = CivicaText(
        "Could not save session.",
        es: "No se pudo guardar la sesión."
    )
}
