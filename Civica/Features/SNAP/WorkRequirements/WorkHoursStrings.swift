import Foundation

// Strings for WorkHoursLogView + AddWorkSessionSheet — English + Spanish parity.

enum WorkHoursStrings {

    // MARK: - Main screen

    static let pageTitle = CivicaText(
        "Work Hours Log",
        es: "Registro de horas laborales",
        zh: "工时记录"
    )

    static let monthlyProgressHeader = CivicaText(
        "This Month's Progress",
        es: "Progreso de este mes",
        zh: "本月进度"
    )

    static let hoursOf = CivicaText(
        "hrs of 80 required",
        es: "hrs de 80 requeridas",
        zh: "小时 / 需要 80 小时"
    )

    static let statusOnTrack = CivicaText(
        "On Track",
        es: "En camino",
        zh: "进度正常"
    )

    static let statusAtRisk = CivicaText(
        "At Risk",
        es: "En riesgo",
        zh: "有风险"
    )

    static let statusComplete = CivicaText(
        "Complete",
        es: "Completado",
        zh: "已完成"
    )

    static let noSessionsYet = CivicaText(
        "No sessions logged yet",
        es: "Aún no hay sesiones registradas",
        zh: "尚未记录任何工时"
    )

    static let noSessionsSubtitle = CivicaText(
        "Tap the button below to log your first work session.",
        es: "Toca el botón de abajo para registrar tu primera sesión de trabajo.",
        zh: "点击下方按钮,记录你的第一次工作。"
    )

    static let addSession = CivicaText(
        "Log Work Session",
        es: "Registrar sesión de trabajo",
        zh: "记录工时"
    )

    static let sessionsThisMonth = CivicaText(
        "Sessions This Month",
        es: "Sesiones este mes",
        zh: "本月记录"
    )

    static let documentBadge = CivicaText(
        "Doc attached",
        es: "Doc. adjunto",
        zh: "已附文件"
    )

    static let loadingError = CivicaText(
        "Could not load your work hours.",
        es: "No se pudieron cargar tus horas laborales.",
        zh: "无法加载你的工时。"
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo",
        zh: "重试"
    )

    // MARK: - Written notice (7 CFR 273.7(g))

    static let noticeTitle = CivicaText(
        "Work Requirement Notice",
        es: "Aviso de requisito laboral",
        zh: "工作要求通知"
    )

    static let noticeBody = CivicaText(
        "Because you are between 18 and 64 years old and do not have a child under 14 in your household, you must work, volunteer, or participate in a qualifying activity for at least 20 hours per week or 80 hours per month to keep your CalFresh benefits (7 CFR 273.24, CF 886).",
        es: "Porque tienes entre 18 y 64 años y no tienes un hijo menor de 14 años en tu hogar, debes trabajar, hacer voluntariado o participar en una actividad calificada al menos 20 horas por semana o 80 horas al mes para conservar tus beneficios de CalFresh (7 CFR 273.24, CF 886).",
        zh: "因为你年龄在 18 至 64 岁之间,且家中没有 14 岁以下的孩子,你必须每周工作、做义工或参加符合条件的活动至少 20 小时,或每月至少 80 小时,才能继续领取 CalFresh 福利(7 CFR 273.24, CF 886)。"
    )

    static let noticeConsequence = CivicaText(
        "If your hours drop below 20 per week (or 80 per month), contact your county within 10 days — by phone, in person, or via BenefitsCal. No specific form is required (7 CFR 273.12(c)).",
        es: "Si tus horas bajan de 20 por semana (o 80 al mes), comunícate con tu condado en un plazo de 10 días — por teléfono, en persona o a través de BenefitsCal. No se requiere ningún formulario específico (7 CFR 273.12(c)).",
        zh: "如果你的工时低于每周 20 小时(或每月 80 小时),请在 10 天内联系你的县办公室 —— 可通过电话、亲自前往或使用 BenefitsCal。无需特定表格(7 CFR 273.12(c))。"
    )

    static let noticeAcknowledge = CivicaText(
        "I understand",
        es: "Entiendo",
        zh: "我明白了"
    )

    // MARK: - Add session sheet

    static let addSheetTitle = CivicaText(
        "Log Work Session",
        es: "Registrar sesión de trabajo",
        zh: "记录工时"
    )

    static let dateLabel = CivicaText(
        "Date",
        es: "Fecha",
        zh: "日期"
    )

    static let hoursLabel = CivicaText(
        "Hours",
        es: "Horas",
        zh: "小时"
    )

    static let activityTypeLabel = CivicaText(
        "Activity Type",
        es: "Tipo de actividad",
        zh: "活动类型"
    )

    static let employerLabel = CivicaText(
        "Employer / Organization (optional)",
        es: "Empleador / Organización (opcional)",
        zh: "雇主 / 机构(可选)"
    )

    static let notesLabel = CivicaText(
        "Notes (optional)",
        es: "Notas (opcional)",
        zh: "备注(可选)"
    )

    static let attachPaystub = CivicaText(
        "Attach Pay Stub or Employer Letter",
        es: "Adjuntar talón de pago o carta de empleador",
        zh: "附上工资单或雇主信"
    )

    static let attachPaystubSubtitle = CivicaText(
        "Pay stubs and employer letters are commonly accepted. Gig workers (Uber, DoorDash, etc.) may use platform earnings statements — contact your county to confirm what they accept.",
        es: "Los talones de pago y cartas de empleador son comúnmente aceptados. Los trabajadores de plataformas digitales (Uber, DoorDash, etc.) pueden usar estados de ganancias de la plataforma — comunícate con tu condado para confirmar lo que aceptan.",
        zh: "工资单和雇主信通常会被接受。零工工作者(Uber、DoorDash 等)可以使用平台收入证明 —— 请联系你的县办公室确认他们接受哪些文件。"
    )

    static let docAttached = CivicaText(
        "Document attached",
        es: "Documento adjunto",
        zh: "已附文件"
    )

    static let saveSession = CivicaText(
        "Save Session",
        es: "Guardar sesión",
        zh: "保存记录"
    )

    static let savingSession = CivicaText(
        "Saving…",
        es: "Guardando…",
        zh: "保存中…"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消"
    )

    static let hoursPlaceholder = CivicaText(
        "e.g. 8",
        es: "p. ej. 8",
        zh: "例如 8"
    )

    static let saveError = CivicaText(
        "Could not save session.",
        es: "No se pudo guardar la sesión.",
        zh: "无法保存记录。"
    )
}
