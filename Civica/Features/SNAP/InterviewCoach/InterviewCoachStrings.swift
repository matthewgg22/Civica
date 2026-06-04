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
        "Practice your SNAP interview with Mae",
        es: "Practica tu entrevista de SNAP con Mae",
        zh: "和 Mae 一起练习你的 SNAP 面谈"
    )
    static let entryBody = CivicaText(
        "Mae helps you rehearse the questions caseworkers actually ask. Pick your state, choose a scenario, and practice communicating your situation clearly. Preparation doesn't affect eligibility — but it can reduce the stress of the interview.",
        es: "Mae te ayuda a practicar las preguntas que realmente hacen los trabajadores sociales. Elige tu estado, elige un escenario, y practica comunicar tu situación con claridad. La preparación no afecta la elegibilidad — pero puede reducir el estrés de la entrevista.",
        zh: "Mae 帮你预演社工真正会问的问题。选择你的州,挑一个情境,练习把你的情况讲清楚。准备不会影响你的资格 — 但能减轻面谈的压力。"
    )
    static let browseTitle = CivicaText(
        "Browse practice questions",
        es: "Explorar preguntas de práctica",
        zh: "浏览练习问题"
    )
    static let browseSubtitle = CivicaText(
        "Read sample interview questions with guidance on how to answer.",
        es: "Lee preguntas de entrevista de ejemplo con guía sobre cómo responder.",
        zh: "阅读面谈样题,并查看如何回答的指引。"
    )
    static let practiceTitle = CivicaText(
        "Start a practice session",
        es: "Iniciar sesión de práctica",
        zh: "开始一次练习"
    )
    // Scenario label mirrors the default practice context, which is
    // SessionContext.defaultCA (PracticeSessionViewModel) since the CA
    // launch. Keep this in sync if the default state changes.
    static let practiceSubtitle = CivicaText(
        "Roleplay with a simulated caseworker. California initial-application scenario.",
        es: "Practica con un trabajador social simulado. Escenario de solicitud inicial de California.",
        zh: "和模拟社工角色扮演。California 初次申请情境。"
    )

    // MARK: Persona picker
    //
    // Shown after the user taps the "Start a practice session" affordance.
    // Lets the navigator (or applicant) deliberately pick a caseworker
    // style + applicant scenario for the upcoming session. The picker
    // surfaces every enum case in CaseworkerArchetype + ApplicantArchetype;
    // unimplemented caseworker variants are still selectable so the UI
    // signals what's coming, but tagged with a "Preview" pill until the
    // backend prompt lands. Skip CTA falls back to SessionContext.defaultCA.

    static let pickerTitle = CivicaText(
        "Choose your interviewer",
        es: "Elige tu entrevistador",
        zh: "选择你的面谈员"
    )
    static let pickerSubtitle = CivicaText(
        "Practice for the caseworker you're worried about. Pick a style and a scenario — or skip to use the defaults.",
        es: "Practica con el trabajador social que te preocupa. Elige un estilo y un escenario — o salta para usar los valores predeterminados.",
        zh: "针对你担心遇到的社工类型来练习。挑一个风格和一个情境 — 或者跳过,使用默认设置。"
    )
    static let pickerCaseworkerSection = CivicaText(
        "Caseworker style",
        es: "Estilo del trabajador social",
        zh: "社工风格"
    )
    static let pickerApplicantSection = CivicaText(
        "Applicant scenario",
        es: "Escenario del solicitante",
        zh: "申请人情境"
    )
    static let pickerStartCTA = CivicaText(
        "Start practice session",
        es: "Iniciar sesión de práctica",
        zh: "开始练习"
    )
    static let pickerSkipCTA = CivicaText(
        "Skip — use defaults",
        es: "Saltar — usar valores predeterminados",
        zh: "跳过 — 使用默认设置"
    )
    static let pickerPreviewBadge = CivicaText(
        "Preview",
        es: "Vista previa",
        zh: "预览"
    )

    // Per-caseworker one-line descriptions. Same closed set as
    // CaseworkerArchetype.allCases — kept here so a future translator
    // doesn't have to touch the model file.
    static let caseworkerDescFriendlyRushed = CivicaText(
        "Warm but watching the clock — moves fast through the questions.",
        es: "Amable pero con prisa — pasa rápido por las preguntas.",
        zh: "态度友好但在赶时间 — 问题问得很快。"
    )
    static let caseworkerDescFormal = CivicaText(
        "By-the-book. Reads questions verbatim and writes down every answer.",
        es: "Apegado al procedimiento. Lee las preguntas literalmente y anota cada respuesta.",
        zh: "照本宣科。逐字念问题,把每个回答都记下来。"
    )
    static let caseworkerDescSkeptical = CivicaText(
        "Probes inconsistencies. Asks follow-ups when numbers don't line up.",
        es: "Sondea inconsistencias. Hace preguntas de seguimiento cuando los números no cuadran.",
        zh: "盯着前后不一致的地方。数字对不上时会追问。"
    )
    static let caseworkerDescLanguageMismatched = CivicaText(
        "Limited shared language. Speak slowly, repeat key numbers and dates.",
        es: "Idioma limitado en común. Habla despacio y repite números y fechas clave.",
        zh: "共通的语言有限。慢慢说,关键的数字和日期重复一遍。"
    )
    static let caseworkerDescAdversarial = CivicaText(
        "Skeptical and pressing. Frames questions as a possible fraud probe.",
        es: "Escéptico e insistente. Plantea las preguntas como un posible sondeo de fraude.",
        zh: "怀疑且咄咄逼人。把问题当作可能的欺诈调查来问。"
    )

    // Per-applicant one-line descriptions.
    static let applicantDescStudent = CivicaText(
        "College or trade student — practice the student-exemption questions.",
        es: "Estudiante universitario o vocacional — practica preguntas sobre exención estudiantil.",
        zh: "大学或职业学校学生 — 练习关于学生豁免的问题。"
    )
    static let applicantDescGigWorker = CivicaText(
        "Gig / variable income — explaining hours and self-employment costs.",
        es: "Trabajo eventual / ingreso variable — explicar horas y gastos por cuenta propia.",
        zh: "零工 / 收入不稳定 — 解释工时和自雇相关的费用。"
    )
    static let applicantDescMixedStatus = CivicaText(
        "Mixed-status household — only eligible members count for benefits.",
        es: "Hogar de estatus mixto — solo los miembros elegibles cuentan para beneficios.",
        zh: "身份混合家庭 — 只有符合资格的成员计入福利。"
    )
    static let applicantDescUnhoused = CivicaText(
        "Unhoused or unstable housing — shelter, mail, and address questions.",
        es: "Sin vivienda o vivienda inestable — preguntas sobre refugio, correo y dirección.",
        zh: "无住所或住所不稳定 — 关于住处、邮件和地址的问题。"
    )
    static let applicantDescSenior = CivicaText(
        "Senior (60+) — medical deductions, fixed income, no work requirements.",
        es: "Adulto mayor (60+) — deducciones médicas, ingresos fijos, sin requisitos laborales.",
        zh: "长者(60 岁及以上)— 医疗扣减、固定收入,无工作要求。"
    )
    static let loadErrorPrefix = CivicaText(
        "Couldn't load practice questions:",
        es: "No se pudieron cargar las preguntas de práctica:",
        zh: "无法加载练习问题:"
    )

    // MARK: Navigation titles

    static let navInterviewCoach = CivicaText(
        "Interview prep with Mae",
        es: "Preparación de entrevista con Mae",
        zh: "和 Mae 一起准备面谈"
    )
    static let navPracticeSession = CivicaText(
        "Practice session",
        es: "Sesión de práctica",
        zh: "练习会话"
    )
    static let navPracticeQuestion = CivicaText(
        "Practice question",
        es: "Pregunta de práctica",
        zh: "练习问题"
    )
    static let navPracticeQuestions = CivicaText(
        "Practice questions",
        es: "Preguntas de práctica",
        zh: "练习问题"
    )
    static let navFeedback = CivicaText(
        "Mae's feedback",
        es: "Comentarios de Mae",
        zh: "Mae 的反馈"
    )

    // MARK: Browser

    static let pickYourState = CivicaText(
        "Pick your state",
        es: "Selecciona tu estado",
        zh: "选择你的州"
    )
    static let comingSoon = CivicaText(
        "Coming soon",
        es: "Próximamente",
        zh: "即将推出"
    )
    static let allCategories = CivicaText(
        "All",
        es: "Todas",
        zh: "全部"
    )
    static let emptyResults = CivicaText(
        "No questions yet for this state and filter.",
        es: "Aún no hay preguntas para este estado y filtro.",
        zh: "这个州和筛选条件下暂时没有问题。"
    )

    // Spanish-only notice rendered in the browser + detail when the
    // user's chosen language differs from the question corpus language.
    // English is empty -- the view should conditionally render only
    // when the language is non-English.
    static let englishOnlyNotice = CivicaText(
        "",
        es: "Las preguntas y la guía están en inglés por ahora. Estamos traduciendo el banco completo.",
        zh: "问题和指引目前是英文。我们正在翻译整个题库。"
    )

    // MARK: Question detail

    static let howToAnswer = CivicaText(
        "How to answer",
        es: "Cómo responder",
        zh: "如何回答"
    )
    static let especiallyRelevantFor = CivicaText(
        "Especially relevant for",
        es: "Especialmente relevante para",
        zh: "特别适用于"
    )

    // MARK: Practice session

    static let caseworkerTyping = CivicaText(
        "Caseworker is typing…",
        es: "El trabajador social está escribiendo…",
        zh: "社工正在输入…"
    )
    static let scoringSession = CivicaText(
        "Mae is reviewing your session…",
        es: "Mae está revisando tu sesión…",
        zh: "Mae 正在回顾你的练习…"
    )
    static let yourAnswerPlaceholder = CivicaText(
        "Your answer…",
        es: "Tu respuesta…",
        zh: "你的回答…"
    )
    static let interviewComplete = CivicaText(
        "Interview complete.",
        es: "Entrevista completada.",
        zh: "面谈完成。"
    )
    static let getFeedback = CivicaText(
        "Get Mae's feedback",
        es: "Obtener los comentarios de Mae",
        zh: "查看 Mae 的反馈"
    )
    static let seeFeedback = CivicaText(
        "See Mae's notes",
        es: "Ver las notas de Mae",
        zh: "查看 Mae 的笔记"
    )
    static let tryAgain = CivicaText(
        "Try again",
        es: "Intentar de nuevo",
        zh: "再试一次"
    )
    static let micAccessNeeded = CivicaText(
        "Enable microphone in Settings",
        es: "Activar micrófono en Configuración",
        zh: "在「设置」中启用麦克风"
    )

    // MARK: Review summary

    static let sessionFeedbackTitle = CivicaText(
        "Mae's feedback",
        es: "Comentarios de Mae",
        zh: "Mae 的反馈"
    )
    static let sessionFeedbackIntro = CivicaText(
        "Here's Mae's read on your practice session — not a prediction of your real interview. It's meant to help you spot strengths to lean on and rough edges to polish before the real thing.",
        es: "Esto es lo que Mae observó en tu sesión de práctica — no una predicción de tu entrevista real. Te ayudará a identificar fortalezas y áreas a mejorar antes de la entrevista oficial.",
        zh: "这是 Mae 对你这次练习的看法 — 不是对真实面谈结果的预测。目的是帮你找出可以发挥的长处,以及在真正面谈前还需要打磨的地方。"
    )
    static let overallScoreLabel = CivicaText(
        "Overall readiness",
        es: "Preparación general",
        zh: "整体准备度"
    )
    static let strengthsHeader = CivicaText(
        "What went well",
        es: "Lo que salió bien",
        zh: "做得好的地方"
    )
    static let improvementsHeader = CivicaText(
        "What to work on",
        es: "Qué practicar",
        zh: "需要练习的地方"
    )
    static let axisCompleteness = CivicaText(
        "Completeness",
        es: "Completitud",
        zh: "完整度"
    )
    static let axisCompletenessHint = CivicaText(
        "Did you address what was asked?",
        es: "¿Respondiste lo que te preguntaron?",
        zh: "你有没有回答到对方问的内容?"
    )
    static let axisAccuracyRisk = CivicaText(
        "Accuracy risk",
        es: "Riesgo de precisión",
        zh: "准确性风险"
    )
    static let axisAccuracyRiskHint = CivicaText(
        "How likely are your answers to be misread as fraud or contradiction?",
        es: "¿Qué tan probable es que tus respuestas se interpreten como fraude o contradicción?",
        zh: "你的回答有多大可能被误读为欺诈或前后矛盾?"
    )
    static let axisMissingContext = CivicaText(
        "Missing context",
        es: "Contexto faltante",
        zh: "缺少的背景信息"
    )
    static let axisMissingContextHint = CivicaText(
        "Did you leave out information that would help your case?",
        es: "¿Omitiste información que ayudaría a tu caso?",
        zh: "你有没有漏掉对你的案件有帮助的信息?"
    )
    static let perTurnNotes = CivicaText(
        "Per-turn notes",
        es: "Notas por turno",
        zh: "每轮笔记"
    )

    static func turnLabel(_ index: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english, .vietnamese, .tagalog: return "Turn \(index)"
        case .mandarin: return "第 \(index) 轮"
        case .spanish: return "Turno \(index)"
        }
    }

    // MARK: Disclaimer / expectation-setting
    //
    // Conservative legal-protection language for the practice tool.
    // Bilingual; rendered as a footer on every Interview Coach surface.
    // Points at California resources (CalFresh / CDSS, 2-1-1 California,
    // LawHelpCA) because CA is the launch state. The prior copy pointed
    // at Massachusetts DTA / masslegalhelp, which was wrong for CA
    // applicants.
    //
    // TODO(legal/CA-counsel): This is legal-protection copy. A
    // California SNAP-knowledgeable legal partner — e.g. CRLA, Bay Area
    // Legal Aid, or Western Center on Law & Poverty — must sign off
    // before this ships. NOT MLRI / GBLS: those are Massachusetts orgs
    // and no longer the right reviewers now that the launch state is CA.
    // Phrasing stays intentionally cautious until that CA sign-off lands.
    //
    // NOTE: these strings hardcode CA rather than reading from
    // SNAPStateResources because the Interview Coach is single-state for
    // the CA launch. If the coach goes multi-state, the agency name /
    // URL / hotline should come from SNAPStateResources.resource(for:)
    // (the single source for state-conditioned copy); the legal-aid +
    // 2-1-1 pointers would still need per-state data added there first.

    static let disclaimerBody = CivicaText(
        "This is a practice tool, not legal advice. For binding answers about your CalFresh (SNAP) application, contact your county CalFresh office (cdss.ca.gov), call 2-1-1 California, or reach a California legal aid organization (lawhelpca.org). Practice prompts and AI feedback are illustrative — they may not match your situation.",
        es: "Esto es una herramienta de práctica, no asesoría legal. Para respuestas vinculantes sobre tu solicitud de CalFresh (SNAP), comunícate con tu oficina local de CalFresh (cdss.ca.gov), llama al 2-1-1 California, o contacta una organización de asistencia legal de California (lawhelpca.org). Las preguntas de práctica y los comentarios de la IA son ilustrativos — pueden no aplicar a tu situación.",
        zh: "这是一个练习工具,不是法律意见。关于你 CalFresh(SNAP)申请的正式答复,请联系你所在县的 CalFresh 办公室(cdss.ca.gov)、拨打 2-1-1 California,或联系 California 的法律援助机构(lawhelpca.org)。练习问题和 AI 反馈仅供参考 — 可能不符合你的具体情况。"
    )

    static let disclaimerCompact = CivicaText(
        "Practice tool — not legal advice.",
        es: "Herramienta de práctica — no es asesoría legal.",
        zh: "练习工具 — 不是法律意见。"
    )
}
