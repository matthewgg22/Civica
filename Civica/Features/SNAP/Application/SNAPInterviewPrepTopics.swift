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

    static func list(language: CivicaLanguage, stateCode: String? = nil) -> [Topic] {
        let topics: [Topic]
        switch language {
        case .english, .vietnamese, .tagalog: topics = englishTopics
        case .mandarin: topics = mandarinTopics
        case .spanish: topics = spanishTopics
        }
        // Patch the day-of-call topic's permission line with the
        // active state's caller-ID text so the prep doesn't mention
        // "Massachusetts DTA" to a CalFresh user.
        return topics.map { topic in
            guard topic.id == "day-of-call" else { return topic }
            return Topic(
                id: topic.id,
                title: topic.title,
                prompts: topic.prompts,
                permission: dayOfCallPermission(stateCode: stateCode, language: language)
            )
        }
    }

    private static func dayOfCallPermission(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyFullName(for: stateCode, language: language)
        let codes = SNAPAgencyDirectory.caseworkerAreaCodes(for: stateCode)
            .map { $0.replacingOccurrences(of: "(", with: "")
                     .replacingOccurrences(of: ")", with: "") }
            .joined(separator: " / ")
        let codePhrase: String
        if codes.isEmpty {
            codePhrase = ""
        } else {
            switch language {
            case .spanish:
                codePhrase = " o un código \(codes)"
            case .mandarin:
                codePhrase = "，或来自 \(codes) 区号"
            case .english, .vietnamese, .tagalog:
                codePhrase = " or a \(codes) area code"
            }
        }
        switch language {
        case .english, .vietnamese, .tagalog:
            return "Caller ID will say \"\(agency)\"\(codePhrase). They will never text you a code or ask for money."
        case .mandarin:
            return "来电显示会显示「\(agency)」\(codePhrase)。他们绝不会给你发短信验证码,也不会向你要钱。"
        case .spanish:
            return "El identificador de llamadas dirá \"\(agency)\"\(codePhrase). Nunca te enviarán un código de verificación ni pedirán dinero."
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

    private static let mandarinTopics: [Topic] = [
        Topic(
            id: "household",
            title: "和你一起生活的人",
            prompts: [
                "所有和你一起买菜或做饭的人",
                "他们和你的关系",
                "他们的年龄,特别是 18 岁以下或 60 岁以上的人",
                "任何有残疾的家庭成员"
            ],
            permission: "如果家庭成员经常进出,就描述你通常的情况即可。"
        ),
        Topic(
            id: "income",
            title: "你的收入",
            prompts: [
                "你每月税前的收入",
                "你多久领一次工资 — 每周、每两周或每月",
                "你在哪里工作,工作了多久",
                "任何非劳动收入 — 社会保障、失业金、子女抚养费、退休金"
            ],
            permission: "如果你的收入每周不同,或者你有不止一份工作,没关系 — 照实描述就好。「会变」就是一个真实的答案。"
        ),
        Topic(
            id: "home",
            title: "你住在哪里",
            prompts: [
                "你目前的邮寄地址",
                "你每月的房租或房贷",
                "你自己支付哪些公用事业费 — 燃气、电、水、暖气",
                "你是否为了能工作而支付托儿费用"
            ],
            permission: nil
        ),
        Topic(
            id: "day-of-call",
            title: "通话当天",
            prompts: [
                "你的带照片身份证件 — 驾照、州 ID 或护照",
                "最近的工资单或收入证明",
                "上个月的房租收据或租约",
                "一支笔和一张纸 — 他们会给你一个确认编号"
            ],
            permission: "来电显示会显示「Massachusetts DTA」或 617 / 508 / 413 / 978 区号。他们绝不会给你发短信验证码,也不会向你要钱。"
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
        es: "Preparación del día anterior",
        zh: "前一天的准备"
    )

    static let title = CivicaText(
        "Four things to think through",
        es: "Cuatro cosas en las que pensar",
        zh: "四件需要先想清楚的事"
    )

    static let subtitle = CivicaText(
        "These aren't answers to memorize — just what to have in mind when they call. Most interviews last 15 to 20 minutes.",
        es: "Estas no son respuestas que memorizar — solo lo que tener en mente cuando llamen. La mayoría de las entrevistas duran de 15 a 20 minutos.",
        zh: "这些不是要背的答案 — 只是接到电话时心里要有数的内容。大多数面谈持续 15 到 20 分钟。"
    )

    static let permissionLabel = CivicaText(
        "It's okay if:",
        es: "Está bien si:",
        zh: "以下情况都没关系:"
    )

    // JR-3 (audit 2026-05-29): leading reassurance card above the
    // day-before topics. Three sentences pre-defuse the dread loop
    // (short call, notes allowed, you will see the questions).
    static let reassuranceLead = CivicaText(
        "Interviews usually take 15\u{2013}20 minutes. You\u{2019}re allowed to have notes. Here\u{2019}s exactly what they\u{2019}ll ask.",
        es: "Las entrevistas usualmente duran de 15 a 20 minutos. Puedes tener notas. Aqu\u{00ED} est\u{00E1} exactamente lo que te van a preguntar.",
        zh: "面谈通常需要 15\u{2013}20 分钟。你可以带笔记。下面就是他们会问的内容。"
    )

    // Footnote: the second-most-cited worry before a SNAP interview
    // (per GetCalFresh field notes) is not having every document ready.
    // Stating up front that follow-ups are normal lowers the stakes of
    // showing up at all, without misrepresenting the interview's role.
    static let reassuranceFollowupsFootnote = CivicaText(
        "Don\u{2019}t worry if you don\u{2019}t have every doc \u{2014} caseworkers can ask follow-ups.",
        es: "No te preocupes si no tienes todos los documentos \u{2014} los trabajadores sociales pueden hacer preguntas de seguimiento.",
        zh: "如果你没有备齐所有文件,也别担心 \u{2014} 工作人员可以再追问。"
    )
}
