import Foundation

// The canonical 12 questions a Massachusetts DTA interviewer
// actually asks during a SNAP eligibility interview, paired with
// suggested phrasings the user can borrow. Sourced from the
// MA DTA Operations Memo + canvas board #12-new.
//
// Brand-voice rule from the canvas: "Coach before, never lecture —
// 'you can say:' beats 'you should say:'." Phrasings are
// suggestions, not scripts.
//
// "You can say" replacements use draft data when available — but at
// v1 the user's name + exact dollars aren't always captured, so
// the suggestions stay illustrative ("$1,820 before taxes" not
// "$$$"). When the orchestrator collects more identifying detail,
// these get personalized.

enum SNAPInterviewQuestions {

    struct Question {
        let questionText: String
        let suggestion: String
    }

    static func list(language: CivicaLanguage) -> [Question] {
        switch language {
        case .english:
            return englishQuestions
        case .spanish:
            return spanishQuestions
        }
    }

    private static let englishQuestions: [Question] = [
        .init(
            questionText: "\"Can you confirm your full name and date of birth?\"",
            suggestion: "Your legal name and birthday as written on your ID."
        ),
        .init(
            questionText: "\"How many people live in your household and buy / prepare food together?\"",
            suggestion: "\"Just me\" / \"Me and my partner\" / \"Three of us — me, my partner, and our daughter\""
        ),
        .init(
            questionText: "\"What's your current mailing address?\"",
            suggestion: "Street, apartment number, city, zip — same as your ID."
        ),
        .init(
            questionText: "\"How much do you make in a typical month, before taxes?\"",
            suggestion: "\"About $1,820 before taxes.\" Use a monthly number, not weekly."
        ),
        .init(
            questionText: "\"Where do you work, and how often do you get paid?\"",
            suggestion: "Employer name, weekly / biweekly / monthly."
        ),
        .init(
            questionText: "\"Does anyone in the household get unearned income — Social Security, unemployment, child support, pension, VA?\"",
            suggestion: "\"Yes, my mom gets $1,100/mo from Social Security\" or \"No.\" Honest yes/no."
        ),
        .init(
            questionText: "\"What's your monthly rent or mortgage?\"",
            suggestion: "\"$1,650 plus gas and electric.\" Include utilities you pay yourself."
        ),
        .init(
            questionText: "\"Anyone in the household 60 or older, or living with a disability?\"",
            suggestion: "Honest yes/no. \"No\" is a complete answer."
        ),
        .init(
            questionText: "\"Do you pay for childcare so you can work?\"",
            suggestion: "\"Yes, $300/mo for after-school care\" or \"No.\" This is a real deduction — say yes if it applies."
        ),
        .init(
            questionText: "\"Any out-of-pocket medical costs over $35/month?\"",
            suggestion: "Only applies if someone is 60+ or disabled. \"Yes, about $60/mo in prescriptions\" or \"No.\""
        ),
        .init(
            questionText: "\"Bank account balance or other resources?\"",
            suggestion: "A general estimate is fine. Massachusetts has no asset test for most households — they're asking for completeness."
        ),
        .init(
            questionText: "\"Anyone in your household a student in college?\"",
            suggestion: "Yes/no. If yes, they'll ask follow-ups about hours worked and dependents."
        ),
    ]

    private static let spanishQuestions: [Question] = [
        .init(
            questionText: "\"¿Puedes confirmar tu nombre completo y fecha de nacimiento?\"",
            suggestion: "Tu nombre legal y fecha de nacimiento como aparecen en tu identificación."
        ),
        .init(
            questionText: "\"¿Cuántas personas viven en tu hogar y compran o preparan comida juntas?\"",
            suggestion: "\"Solo yo\" / \"Mi pareja y yo\" / \"Tres — yo, mi pareja y nuestra hija\""
        ),
        .init(
            questionText: "\"¿Cuál es tu dirección postal actual?\"",
            suggestion: "Calle, número de apartamento, ciudad, código postal — igual que tu identificación."
        ),
        .init(
            questionText: "\"¿Cuánto ganas en un mes típico, antes de impuestos?\"",
            suggestion: "\"Cerca de $1,820 antes de impuestos.\" Usa un número mensual, no semanal."
        ),
        .init(
            questionText: "\"¿Dónde trabajas y con qué frecuencia te pagan?\"",
            suggestion: "Nombre del empleador, semanal / quincenal / mensual."
        ),
        .init(
            questionText: "\"¿Alguien en el hogar recibe ingresos no laborales — Seguro Social, desempleo, manutención de hijos, pensión, VA?\"",
            suggestion: "\"Sí, mi mamá recibe $1,100/mes del Seguro Social\" o \"No.\" Sí o no honesto."
        ),
        .init(
            questionText: "\"¿Cuál es tu renta o hipoteca mensual?\"",
            suggestion: "\"$1,650 más gas y electricidad.\" Incluye los servicios que pagas tú."
        ),
        .init(
            questionText: "\"¿Alguien en el hogar tiene 60 años o más, o vive con una discapacidad?\"",
            suggestion: "Sí o no honesto. \"No\" es una respuesta completa."
        ),
        .init(
            questionText: "\"¿Pagas por cuidado infantil para poder trabajar?\"",
            suggestion: "\"Sí, $300/mes por cuidado extraescolar\" o \"No.\" Es una deducción real — di que sí si aplica."
        ),
        .init(
            questionText: "\"¿Algún gasto médico de tu bolsillo mayor a $35/mes?\"",
            suggestion: "Solo aplica si alguien tiene 60 años o más o vive con una discapacidad. \"Sí, cerca de $60/mes en medicamentos\" o \"No.\""
        ),
        .init(
            questionText: "\"¿Saldo de cuenta bancaria u otros recursos?\"",
            suggestion: "Una estimación general está bien. Massachusetts no tiene prueba de bienes para la mayoría de los hogares — preguntan por completitud."
        ),
        .init(
            questionText: "\"¿Alguien en tu hogar estudia en la universidad?\"",
            suggestion: "Sí o no. Si sí, harán preguntas adicionales sobre horas trabajadas y dependientes."
        ),
    ]
}

// MARK: - Interview view copy

enum SNAPInterviewStrings {

    // MARK: Prep

    static let prepEyebrow = CivicaText(
        "Interview prep",
        es: "Preparación para la entrevista"
    )
    static let prepTitle = CivicaText(
        "The DTA will call you. Here's everything you need.",
        es: "El DTA te llamará. Esto es todo lo que necesitas."
    )
    static let prepBody = CivicaText(
        "Most SNAP interviews are 15–20 minutes by phone. One quick conversation, then it's done. Most people pass on the first try — preparing helps.",
        es: "La mayoría de las entrevistas de SNAP son de 15–20 minutos por teléfono. Una conversación rápida y se acabó. La mayoría pasa al primer intento — prepararte ayuda."
    )

    static let pickUpHeading = CivicaText(
        "Pick up the phone if",
        es: "Contesta el teléfono si"
    )
    static let pickUpBody = CivicaText(
        "The caller ID says \"Massachusetts DTA\" or a 617/508/413/978 area code. They will never text you a verification code. They will never ask for money or banking info.",
        es: "El identificador de llamadas dice \"Massachusetts DTA\" o un código de área 617/508/413/978. Nunca te enviarán un código de verificación. Nunca pedirán dinero ni información bancaria."
    )

    static let haveNearbyHeading = CivicaText(
        "Have these nearby",
        es: "Ten esto cerca"
    )
    static let haveNearbyBody = CivicaText(
        "• Photo ID (driver's license, state ID, or passport)\n• A recent paystub or proof of income\n• Last month's rent receipt or lease\n• A pen — they'll give you a confirmation number at the end",
        es: "• Identificación con foto (licencia, ID estatal o pasaporte)\n• Un talón de pago reciente o prueba de ingresos\n• Recibo de renta del mes pasado o contrato\n• Un bolígrafo — te darán un número de confirmación al final"
    )

    static let prepPrimary = CivicaText(
        "See what they'll ask",
        es: "Ver qué te preguntarán"
    )

    // MARK: Questions

    static let questionsEyebrow = CivicaText(
        "What they'll ask",
        es: "Lo que te preguntarán"
    )
    static let questionsTitle = CivicaText(
        "Twelve questions. You can read these during the call.",
        es: "Doce preguntas. Puedes leerlas durante la llamada."
    )
    static let youCanSayLabel = CivicaText(
        "You can say:",
        es: "Puedes decir:"
    )
    static let dontKnowHeading = CivicaText(
        "Don't know an answer?",
        es: "¿No sabes una respuesta?"
    )
    static let dontKnowBody = CivicaText(
        "\"I'm not sure\" is a real answer. The interviewer writes down \"self-attested\" and moves on. You don't have to know everything off the top of your head.",
        es: "\"No estoy seguro/a\" es una respuesta real. El entrevistador anota \"self-attested\" (auto-declarado) y continúa. No tienes que saberlo todo de memoria."
    )

    // MARK: Live (during call)

    static let liveEyebrow = CivicaText(
        "On the call",
        es: "En la llamada"
    )
    static let nextUpLabel = CivicaText(
        "What's coming next",
        es: "Qué sigue"
    )
    static let stuckHeading = CivicaText(
        "Stuck?",
        es: "¿Atascado?"
    )
    static let stuckBody = CivicaText(
        "\"Can I have a moment to check?\" is completely normal. They'll wait. Take the breath.",
        es: "\"¿Me das un momento para verificar?\" es completamente normal. Te esperarán. Toma el respiro."
    )
    static let liveAdvance = CivicaText(
        "Done with this one",
        es: "Listo con esta"
    )
    static let liveFinished = CivicaText(
        "Interview finished",
        es: "Entrevista terminada"
    )
    static let livePause = CivicaText(
        "End / pause",
        es: "Terminar / pausar"
    )

    static func questionOfLabel(current: Int, total: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Question \(current) of \(total)"
        case .spanish: return "Pregunta \(current) de \(total)"
        }
    }

    // MARK: Wrapup

    static let wrapupEyebrow = CivicaText(
        "After the call",
        es: "Después de la llamada"
    )
    static let wrapupTitle = CivicaText(
        "How did that go?",
        es: "¿Cómo te fue?"
    )
    static let wrapupNoteHeading = CivicaText(
        "What happens next",
        es: "Qué pasa ahora"
    )
    static let wrapupNoteBody = CivicaText(
        "Decision usually within 7 days. We'll text the moment we hear from DTA.",
        es: "La decisión usualmente llega en 7 días. Te enviaremos un mensaje en cuanto sepamos del DTA."
    )

    struct WrapupOptionCopy {
        let title: String
        let body: String
    }

    static func wrapupOption(_ option: SNAPInterviewCoachView.WrapupOption, language: CivicaLanguage) -> WrapupOptionCopy {
        switch (option, language) {
        case (.smooth, .english):
            return .init(
                title: "Smooth — got through everything",
                body: "We mark you done and watch for the decision."
            )
        case (.smooth, .spanish):
            return .init(
                title: "Sin problemas — pasé por todo",
                body: "Te marcamos como completado y esperamos la decisión."
            )
        case (.stuck, .english):
            return .init(
                title: "They asked something I couldn't answer",
                body: "We'll coach you on what to send next — and what \"self-attested\" really means."
            )
        case (.stuck, .spanish):
            return .init(
                title: "Me preguntaron algo que no pude responder",
                body: "Te ayudaremos con qué enviar a continuación — y qué significa \"self-attested\"."
            )
        case (.rude, .english):
            return .init(
                title: "It felt off / they were rude",
                body: "A real person reads this. We can flag the case if you'd like us to."
            )
        case (.rude, .spanish):
            return .init(
                title: "Se sintió raro / fueron groseros",
                body: "Una persona real lee esto. Podemos marcar el caso si quieres."
            )
        case (.noCall, .english):
            return .init(
                title: "They never called",
                body: "Missed-interview is the #2 reason applications get denied. We'll help you reach the supervisor today."
            )
        case (.noCall, .spanish):
            return .init(
                title: "Nunca llamaron",
                body: "Entrevista perdida es la razón #2 por la que se deniegan solicitudes. Te ayudaremos a contactar al supervisor hoy."
            )
        }
    }

    static let wrapupPrimary = CivicaText(
        "Send this to Civica",
        es: "Enviar esto a Civica"
    )

    // MARK: Misc

    static let imOnTheCall = CivicaText(
        "I'm on the call now",
        es: "Estoy en la llamada ahora"
    )
    static let backToPrep = CivicaText(
        "Back to prep",
        es: "Volver a la preparación"
    )
}
