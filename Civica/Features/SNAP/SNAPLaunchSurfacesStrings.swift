import Foundation

// Spanish-parity strings for the launch-critical SNAP surfaces that
// previously used raw Text("...") literals. Each module below maps to a
// single view file; keep entries in the same order they appear on
// screen so reviewers can scan top-to-bottom.

enum SNAPConfirmationStrings {
    static let title = CivicaText(
        "Your SNAP draft is ready",
        es: "Tu borrador de SNAP está listo"
    )
    static let subtitle = CivicaText(
        "You can use this information to complete your official application through your state’s benefits website.",
        es: "Puedes usar esta información para completar tu solicitud oficial en el sitio web de beneficios de tu estado."
    )
    static let stateSelectedLabel = CivicaText(
        "State selected",
        es: "Estado seleccionado"
    )
    static let openOfficialSite = CivicaText(
        "Open official state SNAP website",
        es: "Abrir el sitio oficial de SNAP del estado"
    )
    static let officialLinkComingSoon = CivicaText(
        "Official state link coming soon.",
        es: "Próximamente: enlace oficial del estado."
    )
    static let reviewDraftAgain = CivicaText(
        "Review my draft again",
        es: "Revisar mi borrador de nuevo"
    )
    static let doesNotSubmit = CivicaText(
        "This assistant does not submit your application.",
        es: "Este asistente no envía tu solicitud."
    )
    static let notProvided = CivicaText(
        "Not provided",
        es: "No proporcionado"
    )
}

enum SNAPApplicationGeneratorStrings {
    static let title = CivicaText(
        "Your application packet",
        es: "Tu paquete de solicitud"
    )
    static func subtitle(stateCode: String?, language: CivicaLanguage) -> String {
        let portal = SNAPAgencyDirectory.portalName(for: stateCode)
        let portalEN = portal.isEmpty ? "your state portal" : portal
        let portalES = portal.isEmpty ? "el portal estatal" : portal
        switch language {
        case .english:
            return "Save or share the summary, then finish the official application in \(portalEN)."
        case .spanish:
            return "Guarda o comparte el resumen, luego completa la solicitud oficial en \(portalES)."
        }
    }
    static let generating = CivicaText(
        "Putting your packet together…",
        es: "Preparando tu paquete…"
    )
    static let ready = CivicaText(
        "Your packet is ready.",
        es: "Tu paquete está listo."
    )
    static let saveOrShare = CivicaText(
        "Save or share packet",
        es: "Guardar o compartir paquete"
    )
    static let tryAgain = CivicaText(
        "Try again",
        es: "Intentar de nuevo"
    )
}

enum SNAPEligibilityIntroStrings {
    static let whatIsSNAP = CivicaText(
        "What is SNAP?",
        es: "¿Qué es SNAP?"
    )
    static let snapDescription = CivicaText(
        "The Supplemental Nutrition Assistance Program (commonly referred to as SNAP) is a U.S. government program that helps low-income individuals and families buy food.",
        es: "El Programa de Asistencia Nutricional Suplementaria (conocido como SNAP) es un programa del gobierno de EE. UU. que ayuda a personas y familias de bajos ingresos a comprar alimentos."
    )
    static let ebtRow = CivicaText(
        "Monthly benefits are loaded onto an Electronic Benefits Transfer (EBT) card.",
        es: "Los beneficios mensuales se cargan en una tarjeta de Transferencia Electrónica de Beneficios (EBT)."
    )
    static let cartRow = CivicaText(
        "The card works like a debit card at grocery stores and some farmers markets.",
        es: "La tarjeta funciona como una tarjeta de débito en supermercados y algunos mercados de agricultores."
    )
    static let foodRow = CivicaText(
        "SNAP can buy eligible food items to fruits, vegetables, meat, dairy, bread, and more.",
        es: "SNAP puede comprar alimentos elegibles como frutas, verduras, carne, lácteos, pan y más."
    )
    static let restrictionsRow = CivicaText(
        "SNAP cannot be used for alcohol, tobacco, or hot prepared meals.",
        es: "SNAP no se puede usar para alcohol, tabaco ni comidas calientes preparadas."
    )
    static let prepStatusTitle = CivicaText(
        "SNAP prep status",
        es: "Estado de preparación de SNAP"
    )
    static let statusLabel = CivicaText(
        "Status:",
        es: "Estado:"
    )
    static let prepCompleted = CivicaText(
        "Prep checklist completed",
        es: "Lista de preparación completada"
    )
    static let dateLabel = CivicaText(
        "Date:",
        es: "Fecha:"
    )
    static let openNextSteps = CivicaText(
        "Open next steps",
        es: "Abrir próximos pasos"
    )
    static let prepareApplication = CivicaText(
        "Prepare my SNAP application",
        es: "Preparar mi solicitud de SNAP"
    )
    static let questionnaireTitle = CivicaText(
        "SNAP Application",
        es: "Solicitud de SNAP"
    )
}

enum SNAPReviewStrings {
    static let title = CivicaText(
        "Review your SNAP draft",
        es: "Revisa tu borrador de SNAP"
    )
    static let reviewBeforeSubmitting = CivicaText(
        "Review this before using it to complete your official state application.",
        es: "Revisa esto antes de usarlo para completar tu solicitud oficial del estado."
    )
    static let showNextSteps = CivicaText(
        "Show next steps",
        es: "Mostrar próximos pasos"
    )
    static let edit = CivicaText(
        "Edit",
        es: "Editar"
    )
    static let yes = CivicaText(
        "Yes",
        es: "Sí"
    )
    static let no = CivicaText(
        "No",
        es: "No"
    )
    static let notProvided = CivicaText(
        "Not provided",
        es: "No proporcionado"
    )
    static let notApplicable = CivicaText(
        "Not applicable",
        es: "No aplica"
    )
    static let nothingChecked = CivicaText(
        "Nothing checked yet",
        es: "Aún no marcaste nada"
    )
    static let householdSection = CivicaText(
        "Household",
        es: "Hogar"
    )
    static let locationSection = CivicaText(
        "Location",
        es: "Ubicación"
    )
    static let studentSection = CivicaText(
        "Student status",
        es: "Estado de estudiante"
    )
    static let incomeSection = CivicaText(
        "Income",
        es: "Ingresos"
    )
    static let expensesSection = CivicaText(
        "Expenses",
        es: "Gastos"
    )
    static let documentsSection = CivicaText(
        "Documents checklist",
        es: "Lista de documentos"
    )
    static let householdSize = CivicaText(
        "Household size",
        es: "Tamaño del hogar"
    )
    static let applicantAge = CivicaText(
        "Applicant age",
        es: "Edad del solicitante"
    )
    static let housingStatus = CivicaText(
        "Housing status",
        es: "Estado de vivienda"
    )
    static let stateLabel = CivicaText(
        "State",
        es: "Estado"
    )
    static let zipCode = CivicaText(
        "ZIP code",
        es: "Código postal"
    )
    static let inHigherEducation = CivicaText(
        "In higher education",
        es: "En educación superior"
    )
    static let halfTimeEnrolled = CivicaText(
        "Enrolled half-time",
        es: "Inscrito medio tiempo"
    )
    static let works20Hours = CivicaText(
        "Works 20+ hours/week",
        es: "Trabaja 20+ horas/semana"
    )
    static let workStudy = CivicaText(
        "Participates in work-study",
        es: "Participa en trabajo-estudio"
    )
    static let dependentChild = CivicaText(
        "Responsible for dependent child",
        es: "Responsable de un hijo dependiente"
    )
    static let employmentStatus = CivicaText(
        "Employment status",
        es: "Situación laboral"
    )
    static let monthlyIncome = CivicaText(
        "Monthly income estimate",
        es: "Ingreso mensual estimado"
    )
    static let incomeChanges = CivicaText(
        "Income changes month to month",
        es: "El ingreso cambia mes a mes"
    )
    static let rentOrHousing = CivicaText(
        "Rent or housing",
        es: "Renta o vivienda"
    )
    static let utilities = CivicaText(
        "Utilities",
        es: "Servicios públicos"
    )
    static let childcareOptional = CivicaText(
        "Childcare (optional)",
        es: "Cuidado infantil (opcional)"
    )
    static let medicalOptional = CivicaText(
        "Medical (optional estimate)",
        es: "Médico (estimado opcional)"
    )
    static let itemsChecked = CivicaText(
        "Items checked",
        es: "Elementos marcados"
    )
}

enum SNAPDocumentConfirmationStrings {
    static let title = CivicaText(
        "Does this look right?",
        es: "¿Se ve correcto?"
    )
    static let subtitle = CivicaText(
        "We read these from your photo. Tap 'Fix something' if anything is off.",
        es: "Leímos esto de tu foto. Toca 'Corregir algo' si hay algo incorrecto."
    )
    static let stoppedReading = CivicaText(
        "Thanks — we'll keep it on file. We'll only read paystubs in detail for now.",
        es: "Gracias — lo guardaremos. Por ahora solo leemos comprobantes de pago en detalle."
    )
    static let deductionsHeading = CivicaText(
        "Deductions",
        es: "Deducciones"
    )
    static let doubleCheckHeading = CivicaText(
        "A few things to double-check:",
        es: "Algunas cosas para verificar:"
    )
    static let fixSomething = CivicaText(
        "Fix something",
        es: "Corregir algo"
    )
    static let looksRight = CivicaText(
        "Looks right",
        es: "Se ve bien"
    )
    static let employerLabel = CivicaText(
        "Employer",
        es: "Empleador"
    )
    static let payPeriodLabel = CivicaText(
        "Pay period",
        es: "Período de pago"
    )
    static let payDateLabel = CivicaText(
        "Pay date",
        es: "Fecha de pago"
    )
    static let grossPayLabel = CivicaText(
        "Gross pay (this period)",
        es: "Pago bruto (este período)"
    )
    static let netPayLabel = CivicaText(
        "Net pay (this period)",
        es: "Pago neto (este período)"
    )
    static let hoursWorkedLabel = CivicaText(
        "Hours worked",
        es: "Horas trabajadas"
    )
    static let hourlyRateLabel = CivicaText(
        "Hourly rate",
        es: "Tarifa por hora"
    )
    static let hourlyRateSuffix = CivicaText(
        "/hr",
        es: "/hora"
    )
    static let grossYearToDateLabel = CivicaText(
        "Gross year-to-date",
        es: "Bruto en lo que va del año"
    )
    static func documentTypeAcknowledgement(rawType: String, language: CivicaLanguage) -> String {
        let prettyType = rawType.replacingOccurrences(of: "_", with: " ")
        switch language {
        case .english: return "We saw a \(prettyType)"
        case .spanish: return "Vimos un \(prettyType)"
        }
    }
}

enum SNAPConversationViewStrings {
    static let thinking = CivicaText(
        "Thinking…",
        es: "Pensando…"
    )
    static let youllNeed = CivicaText(
        "You'll need:",
        es: "Necesitarás:"
    )
    static let seeTheMath = CivicaText(
        "See the math",
        es: "Ver el cálculo"
    )
    static let retry = CivicaText(
        "Retry",
        es: "Reintentar"
    )
    static let screenerTitle = CivicaText(
        "SNAP Eligibility Screener",
        es: "Evaluador de elegibilidad de SNAP"
    )
    static let close = CivicaText(
        "Close",
        es: "Cerrar"
    )
    static let confirmUnderstanding = CivicaText(
        "Just to confirm, did I understand your answer correctly?",
        es: "Solo para confirmar, ¿entendí tu respuesta correctamente?"
    )
}

// Existing `SNAPPrivacyNoticeStrings` enum (in SNAPPrivacyNoticeView.swift)
// holds English-only body copy with compliance regression tests that
// assert exact substrings. Spanish parity for those bodies is a separate
// legal-review task. This enum just covers nav/buttons added here.
enum SNAPPrivacyNoticeNavStrings {
    static let continueToPrep = CivicaText(
        "Continue to SNAP prep",
        es: "Continuar a preparación de SNAP"
    )
    static let goToOfficial = CivicaText(
        "Go to official application",
        es: "Ir a la solicitud oficial"
    )
    static let goBack = CivicaText(
        "Go back",
        es: "Volver"
    )
    static let checkWhatYouNeed = CivicaText(
        "Check what you may need",
        es: "Revisa lo que podrías necesitar"
    )
}

enum SNAPApplicationWalkthroughStrings {
    static func submitTo(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        switch language {
        case .english: return "Submit to \(agency)"
        case .spanish: return "Enviar a \(agency)"
        }
    }
    static func openPortalTitle(portal: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Open \(portal)"
        case .spanish: return "Abrir \(portal)"
        }
    }
    static func openPortalDetail(shortURL: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Go to \(shortURL) on your phone or computer."
        case .spanish: return "Ve a \(shortURL) en tu teléfono o computadora."
        }
    }
    static let applyForSNAP = CivicaText(
        "Apply for SNAP",
        es: "Solicitar SNAP"
    )
    static func applyForSNAPDetail(portal: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Tap Apply for SNAP and create or sign into your \(portal) account."
        case .spanish: return "Toca Solicitar SNAP y crea o inicia sesión en tu cuenta de \(portal)."
        }
    }
    static let useYourPacket = CivicaText(
        "Use your packet as a reference",
        es: "Usa tu paquete como referencia"
    )
    static func useYourPacketDetail(agencyShort: String, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return "Answer the official application's questions using the summary you just saved. Upload the documents listed on the last page when \(agencyShort) asks for them."
        case .spanish:
            return "Responde las preguntas de la solicitud oficial usando el resumen que acabas de guardar. Sube los documentos de la última página cuando \(agencyShort) los pida."
        }
    }
    static func footnote(agencyShort: String, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return "Need help? Most \(agencyShort) offices have community navigators who can walk you through the application in person."
        case .spanish:
            return "¿Necesitas ayuda? La mayoría de las oficinas de \(agencyShort) tienen navegadores comunitarios que pueden ayudarte con la solicitud en persona."
        }
    }
}

enum SNAPGenericStrings {
    static let close = CivicaText(
        "Close",
        es: "Cerrar"
    )
    static let back = CivicaText(
        "Back",
        es: "Volver"
    )
    static let searchThisArea = CivicaText(
        "Search this area",
        es: "Buscar en esta área"
    )
}
