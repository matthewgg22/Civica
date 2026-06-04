import Foundation

// Strings for WorkHoursLogView + AddWorkSessionSheet — English + Spanish parity.

enum WorkHoursStrings {

    // MARK: - Main screen

    static let pageTitle = CivicaText(
        "Work Hours Log",
        es: "Registro de horas laborales",
        zh: "工时记录",
        vi: "Nhật ký giờ làm việc"
    )

    static let monthlyProgressHeader = CivicaText(
        "This Month's Progress",
        es: "Progreso de este mes",
        zh: "本月进度",
        vi: "Tiến độ tháng này"
    )

    static let hoursOf = CivicaText(
        "hrs of 80 required",
        es: "hrs de 80 requeridas",
        zh: "小时 / 需要 80 小时",
        vi: "giờ trên 80 giờ yêu cầu"
    )

    static let statusOnTrack = CivicaText(
        "On Track",
        es: "En camino",
        zh: "进度正常",
        vi: "Đúng tiến độ"
    )

    static let statusAtRisk = CivicaText(
        "At Risk",
        es: "En riesgo",
        zh: "有风险",
        vi: "Có nguy cơ"
    )

    static let statusComplete = CivicaText(
        "Complete",
        es: "Completado",
        zh: "已完成",
        vi: "Hoàn thành"
    )

    static let noSessionsYet = CivicaText(
        "No sessions logged yet",
        es: "Aún no hay sesiones registradas",
        zh: "尚未记录任何工时",
        vi: "Chưa ghi nhận buổi làm việc nào"
    )

    static let noSessionsSubtitle = CivicaText(
        "Tap the button below to log your first work session.",
        es: "Toca el botón de abajo para registrar tu primera sesión de trabajo.",
        zh: "点击下方按钮,记录你的第一次工作。",
        vi: "Nhấn nút bên dưới để ghi nhận buổi làm việc đầu tiên của bạn."
    )

    static let addSession = CivicaText(
        "Log Work Session",
        es: "Registrar sesión de trabajo",
        zh: "记录工时",
        vi: "Ghi nhận buổi làm việc"
    )

    static let sessionsThisMonth = CivicaText(
        "Sessions This Month",
        es: "Sesiones este mes",
        zh: "本月记录",
        vi: "Buổi làm việc trong tháng này"
    )

    static let documentBadge = CivicaText(
        "Doc attached",
        es: "Doc. adjunto",
        zh: "已附文件",
        vi: "Đã đính kèm tài liệu"
    )

    static let loadingError = CivicaText(
        "Could not load your work hours.",
        es: "No se pudieron cargar tus horas laborales.",
        zh: "无法加载你的工时。",
        vi: "Không thể tải giờ làm việc của bạn."
    )

    static let retryButton = CivicaText(
        "Try Again",
        es: "Intentar de nuevo",
        zh: "重试",
        vi: "Thử lại"
    )

    // MARK: - Written notice (7 CFR 273.7(g))

    static let noticeTitle = CivicaText(
        "Work Requirement Notice",
        es: "Aviso de requisito laboral",
        zh: "工作要求通知",
        vi: "Thông báo yêu cầu làm việc"
    )

    static let noticeBody = CivicaText(
        "Because you are between 18 and 64 years old and do not have a child under 14 in your household, you must work, volunteer, or participate in a qualifying activity for at least 20 hours per week or 80 hours per month to keep your CalFresh benefits (7 CFR 273.24, CF 886).",
        es: "Porque tienes entre 18 y 64 años y no tienes un hijo menor de 14 años en tu hogar, debes trabajar, hacer voluntariado o participar en una actividad calificada al menos 20 horas por semana o 80 horas al mes para conservar tus beneficios de CalFresh (7 CFR 273.24, CF 886).",
        zh: "因为你年龄在 18 至 64 岁之间,且家中没有 14 岁以下的孩子,你必须每周工作、做义工或参加符合条件的活动至少 20 小时,或每月至少 80 小时,才能继续领取 CalFresh 福利(7 CFR 273.24, CF 886)。",
        vi: "Vì bạn trong độ tuổi từ 18 đến 64 và không có con dưới 14 tuổi trong hộ gia đình, bạn phải làm việc, làm tình nguyện hoặc tham gia một hoạt động đủ điều kiện ít nhất 20 giờ mỗi tuần hoặc 80 giờ mỗi tháng để giữ phúc lợi CalFresh của bạn (7 CFR 273.24, CF 886)."
    )

    static let noticeConsequence = CivicaText(
        "If your hours drop below 20 per week (or 80 per month), contact your county within 10 days — by phone, in person, or via BenefitsCal. No specific form is required (7 CFR 273.12(c)).",
        es: "Si tus horas bajan de 20 por semana (o 80 al mes), comunícate con tu condado en un plazo de 10 días — por teléfono, en persona o a través de BenefitsCal. No se requiere ningún formulario específico (7 CFR 273.12(c)).",
        zh: "如果你的工时低于每周 20 小时(或每月 80 小时),请在 10 天内联系你的县办公室 —— 可通过电话、亲自前往或使用 BenefitsCal。无需特定表格(7 CFR 273.12(c))。",
        vi: "Nếu số giờ của bạn giảm xuống dưới 20 giờ mỗi tuần (hoặc 80 giờ mỗi tháng), hãy liên hệ với county của bạn trong vòng 10 ngày — qua điện thoại, trực tiếp hoặc qua BenefitsCal. Không cần biểu mẫu cụ thể nào (7 CFR 273.12(c))."
    )

    static let noticeAcknowledge = CivicaText(
        "I understand",
        es: "Entiendo",
        zh: "我明白了",
        vi: "Tôi đã hiểu"
    )

    // MARK: - Add session sheet

    static let addSheetTitle = CivicaText(
        "Log Work Session",
        es: "Registrar sesión de trabajo",
        zh: "记录工时",
        vi: "Ghi nhận buổi làm việc"
    )

    static let dateLabel = CivicaText(
        "Date",
        es: "Fecha",
        zh: "日期",
        vi: "Ngày"
    )

    static let hoursLabel = CivicaText(
        "Hours",
        es: "Horas",
        zh: "小时",
        vi: "Số giờ"
    )

    static let activityTypeLabel = CivicaText(
        "Activity Type",
        es: "Tipo de actividad",
        zh: "活动类型",
        vi: "Loại hoạt động"
    )

    static let employerLabel = CivicaText(
        "Employer / Organization (optional)",
        es: "Empleador / Organización (opcional)",
        zh: "雇主 / 机构(可选)",
        vi: "Chủ lao động / Tổ chức (không bắt buộc)"
    )

    static let notesLabel = CivicaText(
        "Notes (optional)",
        es: "Notas (opcional)",
        zh: "备注(可选)",
        vi: "Ghi chú (không bắt buộc)"
    )

    static let attachPaystub = CivicaText(
        "Attach Pay Stub or Employer Letter",
        es: "Adjuntar talón de pago o carta de empleador",
        zh: "附上工资单或雇主信",
        vi: "Đính kèm phiếu lương hoặc thư của chủ lao động"
    )

    static let attachPaystubSubtitle = CivicaText(
        "Pay stubs and employer letters are commonly accepted. Gig workers (Uber, DoorDash, etc.) may use platform earnings statements — contact your county to confirm what they accept.",
        es: "Los talones de pago y cartas de empleador son comúnmente aceptados. Los trabajadores de plataformas digitales (Uber, DoorDash, etc.) pueden usar estados de ganancias de la plataforma — comunícate con tu condado para confirmar lo que aceptan.",
        zh: "工资单和雇主信通常会被接受。零工工作者(Uber、DoorDash 等)可以使用平台收入证明 —— 请联系你的县办公室确认他们接受哪些文件。",
        vi: "Phiếu lương và thư của chủ lao động thường được chấp nhận. Người làm việc tự do (Uber, DoorDash, v.v.) có thể dùng bảng kê thu nhập từ nền tảng — hãy liên hệ với county của bạn để xác nhận họ chấp nhận những giấy tờ nào."
    )

    static let docAttached = CivicaText(
        "Document attached",
        es: "Documento adjunto",
        zh: "已附文件",
        vi: "Đã đính kèm tài liệu"
    )

    static let saveSession = CivicaText(
        "Save Session",
        es: "Guardar sesión",
        zh: "保存记录",
        vi: "Lưu buổi làm việc"
    )

    static let savingSession = CivicaText(
        "Saving…",
        es: "Guardando…",
        zh: "保存中…",
        vi: "Đang lưu…"
    )

    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消",
        vi: "Hủy"
    )

    static let hoursPlaceholder = CivicaText(
        "e.g. 8",
        es: "p. ej. 8",
        zh: "例如 8",
        vi: "ví dụ 8"
    )

    static let saveError = CivicaText(
        "Could not save session.",
        es: "No se pudo guardar la sesión.",
        zh: "无法保存记录。",
        vi: "Không thể lưu buổi làm việc."
    )
}
