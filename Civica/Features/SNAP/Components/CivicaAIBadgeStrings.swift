import Foundation

// Bilingual strings for CivicaAIBadge and CivicaAITransparencyView.
// Follows the CivicaText/value(in:) pattern used across the SNAP
// feature (see InterviewCoachStrings, SNAPLaunchSurfacesStrings) so
// translation review stays close to the surface that consumes the
// copy. Spanish translations marked NEEDS-REVIEW are reasonable first
// passes pending a native reviewer sign-off; see PR description.
enum CivicaAIBadgeStrings {

    // MARK: Badge

    static let label = CivicaText(
        "AI-powered",
        es: "Asistido por IA"
    )
    static let accessibilityLabel = CivicaText(
        "AI-powered feature",
        es: "Función asistida por IA"
    )
    static let accessibilityHintTappable = CivicaText(
        "About AI in this feature",
        es: "Sobre la IA en esta función"
    )
}

enum CivicaAITransparencyStrings {

    // MARK: Screen chrome

    static let navTitle = CivicaText(
        "How AI helps Civica",
        es: "Cómo la IA ayuda en Civica"
    )
    static let intro = CivicaText(
        "Civica uses AI in a few specific places to reduce the paperwork tax of getting benefits. Here's exactly where, and where we don't.",
        es: "Civica usa IA en algunos lugares específicos para reducir la carga de trámites al obtener beneficios. Aquí está exactamente dónde, y dónde no la usamos."
    )

    // MARK: Section A — What we use AI for

    static let useTitle = CivicaText(
        "What we use AI for",
        es: "Para qué usamos IA"
    )
    static let usePracticeTitle = CivicaText(
        "Practice interviews",
        es: "Entrevistas de práctica"
    )
    static let usePracticeBody = CivicaText(
        "A Claude-powered caseworker simulation that asks the same questions a real interviewer would, so you can rehearse before the call.",
        es: "Una simulación de trabajador social impulsada por Claude que hace las mismas preguntas que un entrevistador real, para que puedas practicar antes de la llamada."
    )
    static let useDocumentsTitle = CivicaText(
        "Document extraction",
        es: "Extracción de documentos"
    )
    static let useDocumentsBody = CivicaText(
        "On-device AI reads paystubs and IDs to fill in fields for you. You confirm every value before it's used.",
        es: "La IA en el dispositivo lee comprobantes de pago e identificaciones para llenar campos por ti. Tú confirmas cada valor antes de usarlo."
    )
    static let useVoiceTitle = CivicaText(
        "Voice intake transcription",
        es: "Transcripción de entrada por voz"
    )
    static let useVoiceBody = CivicaText(
        "Speech-to-text plus structured extraction lets you describe your situation out loud instead of typing.",
        es: "Reconocimiento de voz más extracción estructurada te permite describir tu situación en voz alta en lugar de escribir."
    )
    static let useDraftsTitle = CivicaText(
        "Draft generation",
        es: "Generación de borradores"
    )
    static let useDraftsBody = CivicaText(
        "Pre-fills answer drafts you can edit before they go anywhere. Nothing is submitted automatically.",
        es: "Pre-rellena borradores de respuestas que puedes editar antes de que vayan a cualquier lugar. Nada se envía automáticamente."
    )

    // MARK: Section B — Where the data goes

    static let dataTitle = CivicaText(
        "Where the data goes",
        es: "A dónde van los datos"
    )
    static let dataOnDevice = CivicaText(
        "On-device: document scans and voice intake never leave your phone for the extraction step.",
        es: "En el dispositivo: los escaneos de documentos y la entrada por voz nunca salen de tu teléfono para la extracción."
    )
    static let dataBackend = CivicaText(
        "Supabase Edge Functions: Interview Coach practice sessions use Claude Sonnet via our backend. Transcripts are stored for your review and deleted on request.",
        es: "Funciones Edge de Supabase: las sesiones de práctica del Coach de entrevista usan Claude Sonnet mediante nuestro backend. Las transcripciones se guardan para que las revises y se eliminan a pedido."
    )
    static let dataNoTraining = CivicaText(
        "Never used for model training.",
        es: "Nunca se usa para entrenar modelos."
    )

    // MARK: Section C — What we DON'T use AI for

    static let neverTitle = CivicaText(
        "What we DON'T use AI for",
        es: "Para qué NO usamos IA"
    )
    static let neverLegalTitle = CivicaText(
        "Legal advice",
        es: "Asesoría legal"
    )
    static let neverLegalBody = CivicaText(
        "None of this is legal counsel. For binding answers, talk to a legal aid organization.",
        es: "Nada de esto es asesoría legal. Para respuestas vinculantes, comunícate con una organización de asistencia legal."
    )
    static let neverEligibilityTitle = CivicaText(
        "Eligibility determinations",
        es: "Determinaciones de elegibilidad"
    )
    static let neverEligibilityBody = CivicaText(
        "Our deterministic SNAP rules engine — not AI — produces the eligibility estimate you see.",
        es: "Nuestro motor determinista de reglas de SNAP — no la IA — produce la estimación de elegibilidad que ves."
    )
    static let neverSubmissionTitle = CivicaText(
        "Submission to government",
        es: "Envío al gobierno"
    )
    static let neverSubmissionBody = CivicaText(
        "Humans review your packet before any handoff to a navigator or county system.",
        es: "Personas revisan tu paquete antes de cualquier entrega a un asesor o sistema del condado."
    )

    // MARK: Section D — Privacy policy link

    static let privacyLink = CivicaText(
        "Read the full privacy notice",
        es: "Leer el aviso de privacidad completo"
    )
    static let closeButton = CivicaText(
        "Close",
        es: "Cerrar"
    )
}
