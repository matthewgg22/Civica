import Foundation

// User-visible strings for the Recertification Companion module.
// EN + ES at full parity. Pattern follows OnboardingStrings /
// CivicaEntryStrings — each logical string is a CivicaText instance,
// looked up via `.value(in: language)` at the call site.

enum RecertCompanionStrings {
    // MARK: - Home / dashboard

    static let homeTitle = CivicaText(
        "Recertification Companion",
        es: "Acompañante de recertificación",
        zh: "重新认证助手",
        vi: "Trợ lý tái chứng nhận"
    )
    static let homeSubtitle = CivicaText(
        "Stay ahead of your next SNAP recertification.",
        es: "Adelántate a tu próxima recertificación de SNAP.",
        zh: "提前准备你的下一次 SNAP 重新认证。",
        vi: "Chuẩn bị sớm cho lần tái chứng nhận SNAP tiếp theo của bạn."
    )

    static let recertDateLabel = CivicaText(
        "Your next recert",
        es: "Tu próxima recertificación",
        zh: "你的下一次重新认证",
        vi: "Lần tái chứng nhận tiếp theo của bạn"
    )
    static let editDateAction = CivicaText(
        "Edit date",
        es: "Editar fecha",
        zh: "修改日期",
        vi: "Sửa ngày"
    )

    static let unknownDate = CivicaText(
        "Date not set",
        es: "Fecha no establecida",
        zh: "尚未设定日期",
        vi: "Chưa đặt ngày"
    )

    // MARK: - Status summary card (design review D3)

    /// Top-line hero on the dashboard. Renders into the card with a
    /// "{N} days" interpolation. Plural handling is done in the view —
    /// these are the bare templates.
    static let statusInDays = CivicaText(
        "Recert in %d days",
        es: "Recert en %d días",
        zh: "%d 天后重新认证",
        vi: "Tái chứng nhận trong %d ngày"
    )
    static let statusInOneDay = CivicaText(
        "Recert tomorrow",
        es: "Recert mañana",
        zh: "明天重新认证",
        vi: "Tái chứng nhận vào ngày mai"
    )
    static let statusToday = CivicaText(
        "Recert is today",
        es: "Recert es hoy",
        zh: "今天重新认证",
        vi: "Tái chứng nhận là hôm nay"
    )
    static let statusOverdueDays = CivicaText(
        "%d days overdue",
        es: "%d días vencido",
        zh: "已逾期 %d 天",
        vi: "Quá hạn %d ngày"
    )
    static let statusOneDayOverdue = CivicaText(
        "1 day overdue",
        es: "1 día vencido",
        zh: "已逾期 1 天",
        vi: "Quá hạn 1 ngày"
    )
    static let statusUnscheduled = CivicaText(
        "Recert isn't scheduled yet",
        es: "Recert aún no programado",
        zh: "重新认证尚未安排",
        vi: "Tái chứng nhận chưa được lên lịch"
    )
    static let statusActionsNeeded = CivicaText(
        "%d actions needed",
        es: "%d acciones necesarias",
        zh: "需要处理 %d 项",
        vi: "Cần %d việc cần làm"
    )
    static let statusOneActionNeeded = CivicaText(
        "1 action needed",
        es: "1 acción necesaria",
        zh: "需要处理 1 项",
        vi: "Cần 1 việc cần làm"
    )
    static let statusNoActions = CivicaText(
        "Nothing to do right now",
        es: "Nada por hacer por ahora",
        zh: "目前无需处理",
        vi: "Hiện tại không có gì cần làm"
    )

    static let statusCTAStartPhantom = CivicaText(
        "Start phantom recert",
        es: "Iniciar práctica de recert",
        zh: "开始模拟重新认证",
        vi: "Bắt đầu tái chứng nhận thử"
    )
    static let statusCTAViewCalendar = CivicaText(
        "View expiration calendar",
        es: "Ver calendario de vencimientos",
        zh: "查看到期日历",
        vi: "Xem lịch hết hạn"
    )
    static let statusCTAContactNavigator = CivicaText(
        "Contact your navigator",
        es: "Contactar a tu navegador",
        zh: "联系你的导航员",
        vi: "Liên hệ người hướng dẫn của bạn"
    )

    // MARK: - No-date placeholder (design review D4)

    static let noDateTitle = CivicaText(
        "Recert isn't scheduled yet",
        es: "La recertificación aún no está programada",
        zh: "重新认证尚未安排",
        vi: "Tái chứng nhận chưa được lên lịch"
    )
    static let noDateBody = CivicaText(
        "We'll update this once your enrollment is approved.",
        es: "Lo actualizaremos cuando se apruebe tu inscripción.",
        zh: "你的申请获批后,我们会更新此信息。",
        vi: "Chúng tôi sẽ cập nhật khi đơn ghi danh của bạn được duyệt."
    )
    static let noDateExplainerLink = CivicaText(
        "How does recert work?",
        es: "¿Cómo funciona la recertificación?",
        zh: "重新认证是怎么进行的?",
        vi: "Tái chứng nhận hoạt động thế nào?"
    )

    // MARK: - Overdue banner (design review D4)

    static let overdueBannerTitle = CivicaText(
        "Your recert is overdue",
        es: "Tu recertificación está vencida",
        zh: "你的重新认证已逾期",
        vi: "Tái chứng nhận của bạn đã quá hạn"
    )
    /// Body uses a "%d days ago" interpolation. Singular handled in view.
    static let overdueBannerBody = CivicaText(
        "It was due %d days ago — contact your navigator now.",
        es: "Venció hace %d días — contacta a tu navegador ahora.",
        zh: "已逾期 %d 天 — 现在就联系你的导航员。",
        vi: "Đã đến hạn cách đây %d ngày — hãy liên hệ người hướng dẫn ngay."
    )
    static let overdueBannerBodySingular = CivicaText(
        "It was due yesterday — contact your navigator now.",
        es: "Venció ayer — contacta a tu navegador ahora.",
        zh: "昨天就到期了 — 现在就联系你的导航员。",
        vi: "Đã đến hạn từ hôm qua — hãy liên hệ người hướng dẫn ngay."
    )

    // MARK: - Practice section (groups phantom + interview coach)

    /// Header that wraps the Phantom Recert + Interview Coach tiles
    /// — design review D5 disambiguation. Renames make clear that
    /// phantom is "practice the form" and coach is "practice the call."
    static let practiceSectionHeader = CivicaText(
        "Practice for your recert",
        es: "Practica para tu recertificación",
        zh: "为你的重新认证做练习",
        vi: "Luyện tập cho lần tái chứng nhận của bạn"
    )

    // MARK: - Phantom Recert (Feature 1)

    static let phantomEntryTitle = CivicaText(
        "Practice the form",
        es: "Practica el formulario",
        zh: "练习表格",
        vi: "Luyện tập điền đơn"
    )
    static let phantomEntrySubtitle = CivicaText(
        "Walk through what you'll fill out.",
        es: "Repasa lo que vas a llenar.",
        zh: "提前过一遍你要填写的内容。",
        vi: "Xem trước những gì bạn sẽ phải điền."
    )
    static let phantomEntryCTA = CivicaText(
        "Start dry run",
        es: "Comenzar práctica",
        zh: "开始模拟练习",
        vi: "Bắt đầu chạy thử"
    )

    static let phantomSummaryTitle = CivicaText(
        "You're ready for recert",
        es: "Estás listo para recertificar",
        zh: "你已准备好重新认证",
        vi: "Bạn đã sẵn sàng cho tái chứng nhận"
    )
    static let phantomSummarySubtitle = CivicaText(
        "Here's a fresh estimate, what's changed, and what to gather before the real recert.",
        es: "Aquí tienes una estimación nueva, qué ha cambiado y qué reunir antes de la recertificación real.",
        zh: "这是最新的估算、有哪些变化,以及在正式重新认证前你要准备的材料。",
        vi: "Đây là ước tính mới, những gì đã thay đổi, và những thứ cần chuẩn bị trước lần tái chứng nhận thật."
    )
    static let phantomChangesHeader = CivicaText(
        "Since your last recert",
        es: "Desde tu última recertificación",
        zh: "自从你上次重新认证以来",
        vi: "Kể từ lần tái chứng nhận trước của bạn"
    )
    static let phantomChecklistHeader = CivicaText(
        "Before the real recert",
        es: "Antes de la recertificación real",
        zh: "正式重新认证之前",
        vi: "Trước lần tái chứng nhận thật"
    )
    static let phantomCloseCTA = CivicaText(
        "I'll come back later",
        es: "Vuelvo más tarde",
        zh: "我稍后再回来",
        vi: "Tôi sẽ quay lại sau"
    )
    static let phantomStartRealCTA = CivicaText(
        "Start the real recert",
        es: "Comenzar recertificación real",
        zh: "开始正式重新认证",
        vi: "Bắt đầu tái chứng nhận thật"
    )

    // MARK: - Expiration Calendar (Feature 2)

    static let calendarHeader = CivicaText(
        "Documents to refresh",
        es: "Documentos a actualizar",
        zh: "需要更新的文件",
        vi: "Giấy tờ cần cập nhật"
    )
    static let calendarEmptyState = CivicaText(
        "Nothing to refresh right now. We'll let you know when something needs an update.",
        es: "Nada que actualizar por ahora. Te avisaremos cuando algo necesite renovarse.",
        zh: "目前没有需要更新的文件。有需要更新时我们会通知你。",
        vi: "Hiện tại không có gì cần cập nhật. Chúng tôi sẽ báo cho bạn khi có giấy tờ cần làm mới."
    )
    static let actionReplace = CivicaText(
        "Replace",
        es: "Reemplazar",
        zh: "替换",
        vi: "Thay thế"
    )
    static let actionDueBy = CivicaText(
        "By",
        es: "Para",
        zh: "截止",
        vi: "Hạn"
    )

    // MARK: - Reminders (Feature 3)

    static let reminderPermissionTitle = CivicaText(
        "Let us nudge you on the right day",
        es: "Permítenos avisarte el día correcto",
        zh: "让我们在合适的日子提醒你",
        vi: "Hãy để chúng tôi nhắc bạn đúng ngày"
    )
    static let reminderPermissionSubtitle = CivicaText(
        "We send one notification per document, only when it's the right time to upload a fresh one. No promotions, no nags.",
        es: "Enviamos una notificación por documento, solo cuando es el momento adecuado para subir una nueva. Sin promociones, sin insistencia.",
        zh: "每份文件只发一次通知,只在该上传新版本的时候提醒你。没有推销,也不啰嗦。",
        vi: "Chúng tôi gửi một thông báo cho mỗi giấy tờ, chỉ khi đúng lúc cần tải bản mới. Không quảng cáo, không phiền hà."
    )
    static let reminderPermissionAccept = CivicaText(
        "Allow reminders",
        es: "Permitir recordatorios",
        zh: "允许提醒",
        vi: "Cho phép nhắc nhở"
    )
    static let reminderPermissionSkip = CivicaText(
        "Not now",
        es: "Ahora no",
        zh: "暂时不用",
        vi: "Không phải bây giờ"
    )

    // MARK: - Interview Coach (Feature 5)

    static let interviewCoachEntryTitle = CivicaText(
        "Practice the call",
        es: "Practica la llamada",
        zh: "练习电话面谈",
        vi: "Luyện tập cuộc gọi"
    )
    static let interviewCoachEntrySubtitle = CivicaText(
        "Rehearse what the navigator will ask.",
        es: "Ensaya lo que el navegador preguntará.",
        zh: "提前演练导航员会问的问题。",
        vi: "Tập trước những câu người hướng dẫn sẽ hỏi."
    )
    static let interviewCoachEntryCTA = CivicaText(
        "Start",
        es: "Comenzar",
        zh: "开始",
        vi: "Bắt đầu"
    )

    // MARK: - Appeal (Feature 4)

    static let appealEntryTitle = CivicaText(
        "Your case was denied. You can appeal.",
        es: "Tu caso fue denegado. Puedes apelar.",
        zh: "你的申请被拒绝了。你可以提出申诉。",
        vi: "Hồ sơ của bạn đã bị từ chối. Bạn có thể kháng cáo."
    )
    static let appealEntrySubtitle = CivicaText(
        "Most procedural denials are reversed at fair hearing. We'll draft your request — you review and send.",
        es: "La mayoría de las denegaciones por procedimiento se revierten en una audiencia justa. Redactaremos tu solicitud — tú la revisas y envías.",
        zh: "大多数程序性拒绝在公平听证会上会被推翻。我们帮你起草申诉 — 你审阅后再提交。",
        vi: "Phần lớn các từ chối do thủ tục đều được lật ngược tại phiên điều trần công bằng. Chúng tôi sẽ soạn đơn — bạn xem lại rồi gửi."
    )
    static let appealEntryCTA = CivicaText(
        "Start an appeal",
        es: "Iniciar apelación",
        zh: "开始申诉",
        vi: "Bắt đầu kháng cáo"
    )

    static let appealReviewHeader = CivicaText(
        "Review your appeal",
        es: "Revisa tu apelación",
        zh: "审阅你的申诉",
        vi: "Xem lại đơn kháng cáo của bạn"
    )
    static let appealEditCTA = CivicaText(
        "Edit text",
        es: "Editar texto",
        zh: "编辑文本",
        vi: "Sửa văn bản"
    )
    static let appealExportPDF = CivicaText(
        "Save as PDF",
        es: "Guardar como PDF",
        zh: "另存为 PDF",
        vi: "Lưu dưới dạng PDF"
    )
    static let appealOpenStatePortal = CivicaText(
        "Open state portal",
        es: "Abrir portal estatal",
        zh: "打开州政府门户",
        vi: "Mở cổng thông tin tiểu bang"
    )

    static let denialReasonMissedInterview = CivicaText(
        "Missed interview",
        es: "Entrevista perdida",
        zh: "错过了面谈",
        vi: "Lỡ buổi phỏng vấn"
    )
    static let denialReasonMissingDocuments = CivicaText(
        "Missing documents",
        es: "Documentos faltantes",
        zh: "缺少文件",
        vi: "Thiếu giấy tờ"
    )
    static let denialReasonNoResponse = CivicaText(
        "No response to the agency",
        es: "Sin respuesta a la agencia",
        zh: "没有回复机构",
        vi: "Không phản hồi cơ quan"
    )
    static let denialReasonOther = CivicaText(
        "Other procedural reason",
        es: "Otro motivo de procedimiento",
        zh: "其他程序性原因",
        vi: "Lý do thủ tục khác"
    )

    static let scanDenialLetterCTA = CivicaText(
        "Scan the denial letter",
        es: "Escanear la carta de denegación",
        zh: "扫描拒绝通知信",
        vi: "Quét thư từ chối"
    )
    static let enterManuallyCTA = CivicaText(
        "Enter the details yourself",
        es: "Ingresa los detalles tú mismo",
        zh: "自己输入详情",
        vi: "Tự nhập chi tiết"
    )
}
