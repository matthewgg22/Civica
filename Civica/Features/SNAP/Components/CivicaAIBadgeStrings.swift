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
        es: "Asistido por IA",
        zh: "AI 辅助"
    )
    static let accessibilityLabel = CivicaText(
        "AI-powered feature",
        es: "Función asistida por IA",
        zh: "AI 辅助功能"
    )
    static let accessibilityHintTappable = CivicaText(
        "About AI in this feature",
        es: "Sobre la IA en esta función",
        zh: "关于本功能中的 AI"
    )
}

enum CivicaAITransparencyStrings {

    // MARK: Screen chrome

    static let navTitle = CivicaText(
        "How AI helps Civica",
        es: "Cómo la IA ayuda en Civica",
        zh: "AI 如何帮助 Civica"
    )
    static let intro = CivicaText(
        "Civica uses AI in a few specific places to reduce the paperwork tax of getting benefits. Here's exactly where, and where we don't.",
        es: "Civica usa IA en algunos lugares específicos para reducir la carga de trámites al obtener beneficios. Aquí está exactamente dónde, y dónde no la usamos.",
        zh: "Civica 在几个特定环节使用 AI,帮你减少申请福利时的繁琐文书。下面是我们具体在哪里用 AI,以及在哪里不用。"
    )

    // MARK: Section A — What we use AI for

    static let useTitle = CivicaText(
        "What we use AI for",
        es: "Para qué usamos IA",
        zh: "我们在哪里使用 AI"
    )
    static let usePracticeTitle = CivicaText(
        "Practice interviews",
        es: "Entrevistas de práctica",
        zh: "面谈练习"
    )
    static let usePracticeBody = CivicaText(
        "A Claude-powered caseworker simulation that asks the same questions a real interviewer would, so you can rehearse before the call.",
        es: "Una simulación de trabajador social impulsada por Claude que hace las mismas preguntas que un entrevistador real, para que puedas practicar antes de la llamada.",
        zh: "由 Claude 驱动的社工模拟,会问出真实面谈员会问的问题,让你在正式通话前先练一遍。"
    )
    static let useDocumentsTitle = CivicaText(
        "Document extraction",
        es: "Extracción de documentos",
        zh: "文件信息提取"
    )
    static let useDocumentsBody = CivicaText(
        "On-device AI reads paystubs and IDs to fill in fields for you. You confirm every value before it's used.",
        es: "La IA en el dispositivo lee comprobantes de pago e identificaciones para llenar campos por ti. Tú confirmas cada valor antes de usarlo.",
        zh: "设备端的 AI 会读取你的工资单和身份证件,自动填入表单字段。每一项数值在使用前都需要你确认。"
    )
    static let useVoiceTitle = CivicaText(
        "Voice intake transcription",
        es: "Transcripción de entrada por voz",
        zh: "语音录入与转写"
    )
    static let useVoiceBody = CivicaText(
        "Speech-to-text plus structured extraction lets you describe your situation out loud instead of typing.",
        es: "Reconocimiento de voz más extracción estructurada te permite describir tu situación en voz alta en lugar de escribir.",
        zh: "语音转文字加上结构化信息提取,让你可以直接说出自己的情况,不用打字。"
    )
    static let useDraftsTitle = CivicaText(
        "Draft generation",
        es: "Generación de borradores",
        zh: "草稿生成"
    )
    static let useDraftsBody = CivicaText(
        "Pre-fills answer drafts you can edit before they go anywhere. Nothing is submitted automatically.",
        es: "Pre-rellena borradores de respuestas que puedes editar antes de que vayan a cualquier lugar. Nada se envía automáticamente.",
        zh: "先帮你预填答案草稿,你可以修改后再决定怎么用。任何内容都不会自动提交。"
    )

    // MARK: Section B — Where the data goes

    static let dataTitle = CivicaText(
        "Where the data goes",
        es: "A dónde van los datos",
        zh: "你的数据去了哪里"
    )
    static let dataOnDevice = CivicaText(
        "On-device: document scans and voice intake never leave your phone for the extraction step.",
        es: "En el dispositivo: los escaneos de documentos y la entrada por voz nunca salen de tu teléfono para la extracción.",
        zh: "在设备上完成:文件扫描和语音录入在提取信息这一步从不离开你的手机。"
    )
    static let dataBackend = CivicaText(
        "Supabase Edge Functions: Interview Coach practice sessions use Claude Sonnet via our backend. Transcripts are stored for your review and deleted on request.",
        es: "Funciones Edge de Supabase: las sesiones de práctica del Coach de entrevista usan Claude Sonnet mediante nuestro backend. Las transcripciones se guardan para que las revises y se eliminan a pedido.",
        zh: "Supabase Edge Functions:面谈教练的练习会话通过我们的后端使用 Claude Sonnet。对话记录会保存供你查看,你可以随时申请删除。"
    )
    static let dataNoTraining = CivicaText(
        "Never used for model training.",
        es: "Nunca se usa para entrenar modelos.",
        zh: "绝不会用于训练模型。"
    )

    // MARK: Section C — What we DON'T use AI for

    static let neverTitle = CivicaText(
        "What we DON'T use AI for",
        es: "Para qué NO usamos IA",
        zh: "我们不会在哪里使用 AI"
    )
    static let neverLegalTitle = CivicaText(
        "Legal advice",
        es: "Asesoría legal",
        zh: "法律咨询"
    )
    static let neverLegalBody = CivicaText(
        "None of this is legal counsel. For binding answers, talk to a legal aid organization.",
        es: "Nada de esto es asesoría legal. Para respuestas vinculantes, comunícate con una organización de asistencia legal.",
        zh: "这些内容都不构成法律意见。如需具有约束力的答复,请联系法律援助机构。"
    )
    static let neverEligibilityTitle = CivicaText(
        "Eligibility determinations",
        es: "Determinaciones de elegibilidad",
        zh: "资格判定"
    )
    static let neverEligibilityBody = CivicaText(
        "Our deterministic SNAP rules engine — not AI — produces the eligibility estimate you see.",
        es: "Nuestro motor determinista de reglas de SNAP — no la IA — produce la estimación de elegibilidad que ves.",
        zh: "你看到的资格估算来自我们确定性的 SNAP 规则引擎 —— 不是 AI。"
    )
    static let neverSubmissionTitle = CivicaText(
        "Submission to government",
        es: "Envío al gobierno",
        zh: "向政府提交"
    )
    static let neverSubmissionBody = CivicaText(
        "Humans review your packet before any handoff to a navigator or county system.",
        es: "Personas revisan tu paquete antes de cualquier entrega a un asesor o sistema del condado.",
        zh: "在交给协助员或县级系统之前,你的材料包都会先由人工审核。"
    )

    // MARK: Section D — Privacy policy link

    static let privacyLink = CivicaText(
        "Read the full privacy notice",
        es: "Leer el aviso de privacidad completo",
        zh: "阅读完整的隐私声明"
    )
    static let closeButton = CivicaText(
        "Close",
        es: "Cerrar",
        zh: "关闭"
    )
}
