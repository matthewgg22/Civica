import Foundation

// EXPERIMENTAL SILOED MODULE: bilingual UI chrome for the Interview Coach.
//
// Scope deliberately limited to surface chrome: nav titles, button
// labels, section headings, status text, accessibility copy. Question
// prompts and "How to answer" guidance live in
// InterviewQuestions_<state>.json and are NOT translated here -- those
// have legal / benefits-domain nuance that needs a native Spanish
// reviewer with SNAP / DTA expertise. Until that ships, Spanish users
// see translated chrome around English question copy, with an inline
// notice flagging the limitation.
//
// Enum labels (QuestionCategory, InterviewScenario, ApplicantArchetype,
// CaseworkerArchetype) get a parallel `localizedLabel(in:)` extension
// in InterviewCoachModels.swift for the same reason -- they're closed-
// set domain terms, simple enough to translate safely.
enum InterviewCoachStrings {

    // MARK: Entry hub

    static let entryTitle = CivicaText(
        "Practice your SNAP interview",
        es: "Practica tu entrevista de SNAP"
    )
    static let entryBody = CivicaText(
        "Rehearse the questions caseworkers actually ask. Pick your state, choose a scenario, and run through the kinds of prompts that decide how quickly your benefits get approved.",
        es: "Practica las preguntas que realmente hacen los trabajadores sociales. Elige tu estado, elige un escenario, y pasa por las preguntas que deciden qué tan rápido se aprueban tus beneficios."
    )
    static let browseTitle = CivicaText(
        "Browse practice questions",
        es: "Explorar preguntas de práctica"
    )
    static let browseSubtitle = CivicaText(
        "Read sample interview questions with guidance on how to answer.",
        es: "Lee preguntas de entrevista de ejemplo con guía sobre cómo responder."
    )
    static let practiceTitle = CivicaText(
        "Start a practice session",
        es: "Iniciar sesión de práctica"
    )
    static let practiceSubtitle = CivicaText(
        "Roleplay with a simulated caseworker. Massachusetts initial-application scenario.",
        es: "Practica con un trabajador social simulado. Escenario de solicitud inicial de Massachusetts."
    )
    static let loadErrorPrefix = CivicaText(
        "Couldn't load practice questions:",
        es: "No se pudieron cargar las preguntas de práctica:"
    )

    // MARK: Navigation titles

    static let navInterviewCoach = CivicaText(
        "Interview Coach",
        es: "Coach de entrevista"
    )
    static let navPracticeSession = CivicaText(
        "Practice session",
        es: "Sesión de práctica"
    )
    static let navPracticeQuestion = CivicaText(
        "Practice question",
        es: "Pregunta de práctica"
    )
    static let navPracticeQuestions = CivicaText(
        "Practice questions",
        es: "Preguntas de práctica"
    )
    static let navFeedback = CivicaText(
        "Feedback",
        es: "Comentarios"
    )

    // MARK: Browser

    static let pickYourState = CivicaText(
        "Pick your state",
        es: "Selecciona tu estado"
    )
    static let comingSoon = CivicaText(
        "Coming soon",
        es: "Próximamente"
    )
    static let allCategories = CivicaText(
        "All",
        es: "Todas"
    )
    static let emptyResults = CivicaText(
        "No questions yet for this state and filter.",
        es: "Aún no hay preguntas para este estado y filtro."
    )

    // Spanish-only notice rendered in the browser + detail when the
    // user's chosen language differs from the question corpus language.
    // English is empty -- the view should conditionally render only
    // when the language is non-English.
    static let englishOnlyNotice = CivicaText(
        "",
        es: "Las preguntas y la guía están en inglés por ahora. Estamos traduciendo el banco completo."
    )

    // MARK: Question detail

    static let howToAnswer = CivicaText(
        "How to answer",
        es: "Cómo responder"
    )
    static let especiallyRelevantFor = CivicaText(
        "Especially relevant for",
        es: "Especialmente relevante para"
    )

    // MARK: Practice session

    static let caseworkerTyping = CivicaText(
        "Caseworker is typing…",
        es: "El trabajador social está escribiendo…"
    )
    static let scoringSession = CivicaText(
        "Scoring your session…",
        es: "Evaluando tu sesión…"
    )
    static let yourAnswerPlaceholder = CivicaText(
        "Your answer…",
        es: "Tu respuesta…"
    )
    static let interviewComplete = CivicaText(
        "Interview complete.",
        es: "Entrevista completada."
    )
    static let getFeedback = CivicaText(
        "Get feedback",
        es: "Obtener comentarios"
    )
    static let seeFeedback = CivicaText(
        "See feedback",
        es: "Ver comentarios"
    )
    static let tryAgain = CivicaText(
        "Try again",
        es: "Intentar de nuevo"
    )

    // MARK: Review summary

    static let sessionFeedbackTitle = CivicaText(
        "Session feedback",
        es: "Comentarios de la sesión"
    )
    static let sessionFeedbackIntro = CivicaText(
        "These scores reflect how a caseworker would likely read your answers. Lower accuracy-risk and lower missing-context are better; higher completeness is better.",
        es: "Estos puntajes reflejan cómo un trabajador social probablemente leería tus respuestas. Menos riesgo de precisión y menos contexto faltante es mejor; más completitud es mejor."
    )
    static let axisCompleteness = CivicaText(
        "Completeness",
        es: "Completitud"
    )
    static let axisCompletenessHint = CivicaText(
        "Did you address what was asked?",
        es: "¿Respondiste lo que te preguntaron?"
    )
    static let axisAccuracyRisk = CivicaText(
        "Accuracy risk",
        es: "Riesgo de precisión"
    )
    static let axisAccuracyRiskHint = CivicaText(
        "How likely are your answers to be misread as fraud or contradiction?",
        es: "¿Qué tan probable es que tus respuestas se interpreten como fraude o contradicción?"
    )
    static let axisMissingContext = CivicaText(
        "Missing context",
        es: "Contexto faltante"
    )
    static let axisMissingContextHint = CivicaText(
        "Did you leave out information that would help your case?",
        es: "¿Omitiste información que ayudaría a tu caso?"
    )
    static let perTurnNotes = CivicaText(
        "Per-turn notes",
        es: "Notas por turno"
    )

    static func turnLabel(_ index: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Turn \(index)"
        case .spanish: return "Turno \(index)"
        }
    }
}
