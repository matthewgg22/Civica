import Foundation

// Topic-based interview prep content surfaced 24 hours before the
// SNAP caseworker call. Four buckets that compress the 12 canonical
// MA DTA questions into "what to think through" — explicitly NOT
// pre-filled answers, per Interview Navigator v1: bulleted prompts
// the user can read in their language without freezing.
//
// Different shape from SNAPInterviewQuestions on purpose:
//   • SNAPInterviewQuestions = the literal 12, paired with "you can
//     say:" sample phrasings for the live-call coach.
//   • SNAPInterviewPrepTopics = 4 topical buckets with prompts +
//     optional permission-giving line, for the day-before prep.
//
// The income bucket carries the permission-giving copy called out in
// the Interview Navigator brief: variable income + multiple jobs are
// the most common freeze points, and the user needs to hear that
// describing the situation honestly is a complete answer.

enum SNAPInterviewPrepTopics {

    struct Topic: Identifiable {
        let id: String
        let title: String
        let prompts: [String]
        let permission: String?
    }

    static func list(language: CivicaLanguage) -> [Topic] {
        switch language {
        case .english: return englishTopics
        case .spanish: return spanishTopics
        }
    }

    private static let englishTopics: [Topic] = [
        Topic(
            id: "household",
            title: "Who lives with you",
            prompts: [
                "Everyone who buys or prepares meals with you",
                "Their relationship to you",
                "Their ages, especially anyone under 18 or over 60",
                "Anyone living with a disability"
            ],
            permission: "If household members come and go, just describe your usual situation."
        ),
        Topic(
            id: "income",
            title: "Your income",
            prompts: [
                "How much you make per month before taxes",
                "How often you're paid — weekly, biweekly, monthly",
                "Where you work, and how long you've been there",
                "Any unearned income — Social Security, unemployment, child support, pension"
            ],
            permission: "If your income varies week to week, or you have more than one job, that's fine — describe it as it is. \"It changes\" is a real answer."
        ),
        Topic(
            id: "home",
            title: "Where you live",
            prompts: [
                "Your current mailing address",
                "Your monthly rent or mortgage",
                "Which utilities you pay yourself — gas, electric, water, heat",
                "Whether you pay for childcare so you can work"
            ],
            permission: nil
        ),
        Topic(
            id: "day-of-call",
            title: "The day of the call",
            prompts: [
                "Your photo ID — driver's license, state ID, or passport",
                "A recent paystub or proof of income",
                "Last month's rent receipt or your lease",
                "A pen and paper — they'll give you a confirmation number"
            ],
            permission: "Caller ID will say \"Massachusetts DTA\" or a 617 / 508 / 413 / 978 area code. They will never text you a code or ask for money."
        )
    ]

    private static let spanishTopics: [Topic] = [
        Topic(
            id: "household",
            title: "Quién vive contigo",
            prompts: [
                "Todos los que compran o preparan comida contigo",
                "Su relación contigo",
                "Sus edades, especialmente menores de 18 o mayores de 60",
                "Cualquier persona que viva con una discapacidad"
            ],
            permission: "Si los miembros del hogar van y vienen, simplemente describe tu situación habitual."
        ),
        Topic(
            id: "income",
            title: "Tus ingresos",
            prompts: [
                "Cuánto ganas por mes antes de impuestos",
                "Con qué frecuencia te pagan — semanal, quincenal, mensual",
                "Dónde trabajas y cuánto tiempo llevas allí",
                "Cualquier ingreso no laboral — Seguro Social, desempleo, manutención, pensión"
            ],
            permission: "Si tus ingresos cambian de semana a semana, o tienes más de un trabajo, está bien — descríbelo como es. \"Cambia\" es una respuesta real."
        ),
        Topic(
            id: "home",
            title: "Dónde vives",
            prompts: [
                "Tu dirección postal actual",
                "Tu renta o hipoteca mensual",
                "Qué servicios pagas tú — gas, electricidad, agua, calefacción",
                "Si pagas por cuidado infantil para poder trabajar"
            ],
            permission: nil
        ),
        Topic(
            id: "day-of-call",
            title: "El día de la llamada",
            prompts: [
                "Tu identificación con foto — licencia, ID estatal o pasaporte",
                "Un talón de pago reciente o prueba de ingresos",
                "Recibo de renta del mes pasado o tu contrato",
                "Un bolígrafo y papel — te darán un número de confirmación"
            ],
            permission: "El identificador de llamadas dirá \"Massachusetts DTA\" o un código 617 / 508 / 413 / 978. Nunca te enviarán un código de verificación ni pedirán dinero."
        )
    ]
}

// MARK: - Prep view copy

enum SNAPInterviewPrepStrings {
    static let eyebrow = CivicaText(
        "Day-before prep",
        es: "Preparación del día anterior"
    )

    static let title = CivicaText(
        "Four things to think through",
        es: "Cuatro cosas en las que pensar"
    )

    static let subtitle = CivicaText(
        "These aren't answers to memorize — just what to have in mind when they call. Most interviews last 15 to 20 minutes.",
        es: "Estas no son respuestas que memorizar — solo lo que tener en mente cuando llamen. La mayoría de las entrevistas duran de 15 a 20 minutos."
    )

    static let permissionLabel = CivicaText(
        "It's okay if:",
        es: "Está bien si:"
    )
}
