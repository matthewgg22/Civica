import Foundation

// Strings for all Marketplace screens (01–06) — English + Spanish parity
// per HANDOFF #4 gate. Each entry corresponds to a raw user-facing literal
// that would otherwise bypass CivicaText and break the ES parity check.

enum SNAPMarketplaceStrings {

    // MARK: - SNAPJobsView (Screen 02)

    static let jobsNavTitle = CivicaText(
        "Jobs for you",
        es: "Empleos para ti",
        zh: "为你推荐的工作",
        vi: "Việc làm cho bạn",
        tl: "Mga trabaho para sa iyo"
    )
    static let openHoursPrefix = CivicaText(
        "Open hours: ",
        es: "Horario: ",
        zh: "营业时间:",
        vi: "Giờ làm việc: ",
        tl: "Oras na bukas: "
    )
    // Screen 02 Canvas provenance attribution (D6)
    static let canvasProvenance = CivicaText(
        "Schedule synced from Canvas",
        es: "Horario sincronizado desde Canvas",
        zh: "课程表已从 Canvas 同步",
        vi: "Lịch học đã đồng bộ từ Canvas",
        tl: "Naka-sync ang iskedyul mula sa Canvas"
    )
    static let incomeCapPrefix = CivicaText(
        "Income cap: $",
        es: "Límite de ingresos: $",
        zh: "收入上限:$",
        vi: "Giới hạn thu nhập: $",
        tl: "Limitasyon sa kita: $"
    )
    static let incomeCapSuffix = CivicaText(
        "/mo before benefit changes",
        es: "/mes antes de cambios en el beneficio",
        zh: "/月,超过此金额你的福利会变动",
        vi: "/tháng trước khi trợ cấp thay đổi",
        tl: "/buwan bago magbago ang iyong benepisyo"
    )
    // Screen 02 income cap hero layout (D2)
    static let incomeCapLabel = CivicaText(
        "INCOME CAP",
        es: "LÍMITE DE INGRESOS",
        zh: "收入上限",
        vi: "GIỚI HẠN THU NHẬP",
        tl: "LIMITASYON SA KITA"
    )
    static let incomeCapPerMonth = CivicaText(
        "/mo",
        es: "/mes",
        zh: "/月",
        vi: "/tháng"
    )
    static let incomeCapChangeNote = CivicaText(
        "before your benefit changes",
        es: "antes de que cambie tu beneficio",
        zh: "超过此金额你的福利会变动",
        vi: "trước khi trợ cấp của bạn thay đổi",
        tl: "bago magbago ang iyong benepisyo"
    )
    static let incomeCapA11y = CivicaText(
        "Income cap: $%d per month. Earn more and your benefit adjusts.",
        es: "Límite de ingresos: $%d por mes. Si ganas más, tu beneficio cambia.",
        zh: "收入上限:每月 $%d。如果赚得更多,你的福利会相应调整。",
        vi: "Giới hạn thu nhập: $%d mỗi tháng. Kiếm nhiều hơn thì trợ cấp của bạn sẽ điều chỉnh.",
        tl: "Limitasyon sa kita: $%d kada buwan. Kumita ka pa nang higit at mag-a-adjust ang iyong benepisyo."
    )
    static let showMore = CivicaText(
        "Show more",
        es: "Ver más",
        zh: "查看更多",
        vi: "Xem thêm",
        tl: "Magpakita pa"
    )
    static let filter = CivicaText(
        "Filter",
        es: "Filtrar",
        zh: "筛选",
        vi: "Lọc",
        tl: "I-filter"
    )

    // MARK: - SNAPRecertRefreshView (Screen 06)

    static let recertNavTitle = CivicaText(
        "Recertify",
        es: "Recertificar",
        zh: "重新认证",
        vi: "Tái chứng nhận",
        tl: "Mag-recertify"
    )
    static let packetReady = CivicaText(
        "Most of your packet is ready",
        es: "La mayor parte de tu expediente está listo",
        zh: "你的材料大部分已经准备好",
        vi: "Phần lớn hồ sơ của bạn đã sẵn sàng",
        tl: "Halos handa na ang iyong packet"
    )
    static let practiceInterview = CivicaText(
        "Practice your county interview",
        es: "Practica tu entrevista del condado",
        zh: "练习你的县级面谈",
        vi: "Luyện tập buổi phỏng vấn với quận của bạn",
        tl: "Mag-practice para sa iyong interbyu sa county"
    )
    static let interviewDuration = CivicaText(
        "8 min · voice or text",
        es: "8 min · voz o texto",
        zh: "8 分钟 · 语音或文字",
        vi: "8 phút · giọng nói hoặc văn bản",
        tl: "8 minuto · boses o teksto"
    )
    static let startButton = CivicaText(
        "Start",
        es: "Comenzar",
        zh: "开始",
        vi: "Bắt đầu",
        tl: "Magsimula"
    )

    // MARK: - SNAPApplyHandoffView (Screen 04)

    static let applyNavTitle = CivicaText(
        "Apply",
        es: "Solicitar",
        zh: "申请",
        vi: "Nộp đơn",
        tl: "Mag-apply"
    )
    static let applyHeroHeadline = CivicaText(
        "Apply to Dining Services through Handshake",
        es: "Solicita en Dining Services a través de Handshake",
        zh: "通过 Handshake 申请 Dining Services 的职位",
        vi: "Nộp đơn vào Dining Services qua Handshake",
        tl: "Mag-apply sa Dining Services sa pamamagitan ng Handshake"
    )
    static let handshakeIntro = CivicaText(
        "Handshake is your campus's official jobs platform. Civica passes your verified income and class schedule so you don't re-enter them.",
        es: "Handshake es la plataforma oficial de empleos de tu campus. Civica compartirá tu resumen de elegibilidad laboral para que tu solicitud esté prellenada.",
        zh: "Handshake 是你校园的官方招聘平台。Civica 会把已验证的收入和课程表传过去,这样你就不用再次填写。",
        vi: "Handshake là nền tảng việc làm chính thức của trường bạn. Civica chuyển thu nhập đã xác minh và lịch học của bạn sang đó để bạn không phải nhập lại.",
        tl: "Ang Handshake ang opisyal na platform ng trabaho ng iyong campus. Ipinapasa ng Civica ang iyong na-verify na kita at iskedyul ng klase para hindi mo na kailangang ulitin ang pag-type."
    )
    static let notSharedNote = CivicaText(
        "Handshake will see only what's needed for your application. Civica does not share your benefit amount.",
        es: "Handshake solo verá lo necesario para tu solicitud, no tu estado de SNAP ni tus ingresos.",
        zh: "Handshake 只会看到申请所需的信息。Civica 不会分享你的福利金额。",
        vi: "Handshake chỉ thấy những gì cần cho đơn của bạn. Civica không chia sẻ số tiền trợ cấp của bạn.",
        tl: "Makikita lang ng Handshake ang kailangan para sa iyong aplikasyon. Hindi ibinabahagi ng Civica ang halaga ng iyong benepisyo."
    )
    static let continueTo = CivicaText(
        "Continue to ",
        es: "Continuar a ",
        zh: "继续前往 ",
        vi: "Tiếp tục đến ",
        tl: "Magpatuloy sa "
    )
    // Proper noun — identical in both languages
    static let handshakeBrand = CivicaText(
        "Handshake",
        es: "Handshake",
        zh: "Handshake",
        vi: "Handshake"
    )
    // Directional arrow glyph — language-neutral decorative suffix
    static let arrowSuffix = CivicaText(
        " \u{2192}",
        es: " \u{2192}",
        zh: " \u{2192}",
        vi: " \u{2192}"
    )
    // Preview-only label
    static let tapToOpenSheet = CivicaText(
        "Tap to open sheet",
        es: "Toca para abrir",
        zh: "点击打开",
        vi: "Nhấn để mở",
        tl: "I-tap para buksan"
    )
    // Screen 04 shared-data card row labels
    static let sharedRowPlaid = CivicaText(
        "Income verified by Plaid",
        es: "Ingresos verificados por Plaid",
        zh: "收入已由 Plaid 验证",
        vi: "Thu nhập đã được Plaid xác minh",
        tl: "Na-verify ng Plaid ang kita"
    )
    static let sharedRowCanvas = CivicaText(
        "Class schedule from Canvas",
        es: "Horario de clases de Canvas",
        zh: "课程表来自 Canvas",
        vi: "Lịch học từ Canvas",
        tl: "Iskedyul ng klase mula sa Canvas"
    )
    static let sharedRowSnapEligible = CivicaText(
        "SNAP-eligible status confirmed",
        es: "Estado elegible para SNAP confirmado",
        zh: "已确认 SNAP 资格",
        vi: "Đã xác nhận đủ điều kiện nhận SNAP",
        tl: "Nakumpirma na ang pagiging kwalipikado sa SNAP"
    )
    // Screen 04 disconnected-source state (D5)
    static let reconnect = CivicaText(
        "Reconnect",
        es: "Reconectar",
        zh: "重新连接",
        vi: "Kết nối lại",
        tl: "Ikonekta ulit"
    )
    static let disconnectedSource = CivicaText(
        "Not connected",
        es: "No conectado",
        zh: "未连接",
        vi: "Chưa kết nối",
        tl: "Hindi nakakonekta"
    )

    // MARK: - SNAPPlacementUpdateView (Screen 05)

    static let updateNavTitle = CivicaText(
        "Update",
        es: "Actualización",
        zh: "更新",
        vi: "Cập nhật",
        tl: "I-update"
    )
    static let diningServicesPrefix = CivicaText(
        "Dining Services · $",
        es: "Dining Services · $",
        zh: "Dining Services · $",
        vi: "Dining Services · $"
    )
    static let firstPaycheck = CivicaText(
        "(first paycheck)",
        es: "(primer cheque)",
        zh: "(首次工资)",
        vi: "(kỳ lương đầu tiên)",
        tl: "(unang sahod)"
    )
    static let confirmedViaPrefix = CivicaText(
        "Confirmed via ",
        es: "Confirmado mediante ",
        zh: "已通过 ",
        vi: "Đã xác nhận qua ",
        tl: "Nakumpirma sa pamamagitan ng "
    )
    static let confirmedViaSuffix = CivicaText(
        " from your direct deposit.",
        es: " de tu depósito directo.",
        zh: " 从你的直接存款中确认。",
        vi: " từ khoản tiền gửi trực tiếp của bạn.",
        tl: " mula sa iyong direct deposit."
    )
    static let yourBenefitEstimate = CivicaText(
        "YOUR BENEFIT ESTIMATE",
        es: "TU ESTIMACIÓN DE BENEFICIO",
        zh: "你的福利估算",
        vi: "ƯỚC TÍNH TRỢ CẤP CỦA BẠN",
        tl: "TANTIYA NG IYONG BENEPISYO"
    )
    static let was = CivicaText(
        "WAS",
        es: "ERA",
        zh: "之前",
        vi: "TRƯỚC ĐÂY",
        tl: "DATI"
    )
    static let now = CivicaText(
        "NOW",
        es: "AHORA",
        zh: "现在",
        vi: "BÂY GIỜ",
        tl: "NGAYON"
    )
    static let countyNotified = CivicaText(
        "Your county worker has been notified. No action needed.",
        es: "Tu trabajador del condado ha sido notificado. No se necesita ninguna acción.",
        zh: "你的县级工作人员已收到通知。你不需要做任何操作。",
        vi: "Nhân viên quận của bạn đã được thông báo. Bạn không cần làm gì thêm.",
        tl: "Napaalalahanan na ang iyong county worker. Wala ka nang kailangang gawin."
    )
    static let obbbaWorkHourLog = CivicaText(
        "OBBBA WORK-HOUR LOG",
        es: "REGISTRO DE HORAS OBBBA",
        zh: "OBBBA 工时记录",
        vi: "NHẬT KÝ GIỜ LÀM VIỆC OBBBA",
        tl: "TALAAN NG ORAS NG TRABAHO SA OBBBA"
    )
    // " of X hours" split into prefix (" of ") + suffix (" hours") so the
    // interpolated count can be inserted between them in the view.
    static let ofPrefix = CivicaText(
        " of ",
        es: " de ",
        zh: " / ",
        vi: " / ",
        tl: " sa "
    )
    static let hoursSuffix = CivicaText(
        " hours",
        es: " horas",
        zh: " 小时",
        vi: " giờ",
        tl: " oras"
    )
    static let autoCountsNote = CivicaText(
        "Civica auto-counts hours from your verified employer. No timesheet to submit.",
        es: "Civica cuenta automáticamente las horas de tu empleador verificado. No se necesita entrada manual.",
        zh: "Civica 会自动从已验证的雇主那里统计工时。你不需要提交工时表。",
        vi: "Civica tự động đếm giờ từ chủ lao động đã xác minh của bạn. Bạn không cần nộp bảng chấm công.",
        tl: "Awtomatikong binibilang ng Civica ang mga oras mula sa iyong na-verify na employer. Walang timesheet na kailangang isumite."
    )
    // Screen 05 navigator escalation (D11)
    static let navigatorEscalationTitle = CivicaText(
        "Talk to your navigator",
        es: "Habla con tu navegador",
        zh: "联系你的导航员",
        vi: "Trò chuyện với nhân viên hỗ trợ của bạn",
        tl: "Makipag-usap sa iyong navigator"
    )
    static let navigatorEscalationSub = CivicaText(
        "Message your assigned worker about this change.",
        es: "Envía un mensaje a tu trabajador asignado sobre este cambio.",
        zh: "向你指定的工作人员发消息说明这个变化。",
        vi: "Nhắn tin cho nhân viên được chỉ định của bạn về thay đổi này.",
        tl: "Mag-message sa iyong itinalagang worker tungkol sa pagbabagong ito."
    )

    // MARK: - PostPlacementView (deprecated Screen 05 wrapper)

    static let paycheckConfirmedPrefix = CivicaText(
        "Paycheck confirmed · ",
        es: "Cheque confirmado · ",
        zh: "工资已确认 · ",
        vi: "Đã xác nhận lương · ",
        tl: "Nakumpirma ang sahod · "
    )
    static let confirmedViaArgyle = CivicaText(
        "Confirmed via Argyle from your direct deposit.",
        es: "Confirmado mediante Argyle desde tu depósito directo.",
        zh: "已通过 Argyle 从你的直接存款中确认。",
        vi: "Đã xác nhận qua Argyle từ khoản tiền gửi trực tiếp của bạn.",
        tl: "Nakumpirma sa pamamagitan ng Argyle mula sa iyong direct deposit."
    )
    static let yourBenefitEstimateLabel = CivicaText(
        "Your benefit estimate",
        es: "Tu estimación de beneficio",
        zh: "你的福利估算",
        vi: "Ước tính trợ cấp của bạn",
        tl: "Tantiya ng iyong benepisyo"
    )
    static let wasLabel = CivicaText(
        "Was",
        es: "Era",
        zh: "之前",
        vi: "Trước đây",
        tl: "Dati"
    )
    static let nowLabel = CivicaText(
        "Now",
        es: "Ahora",
        zh: "现在",
        vi: "Bây giờ",
        tl: "Ngayon"
    )
    static let incomeExceedsLimit = CivicaText(
        "Your income may exceed the benefit limit",
        es: "Tus ingresos pueden superar el límite del beneficio",
        zh: "你的收入可能超过福利上限",
        vi: "Thu nhập của bạn có thể vượt quá giới hạn trợ cấp",
        tl: "Maaaring lumampas ang iyong kita sa limitasyon ng benepisyo"
    )
    static let navigatorReviewingCase = CivicaText(
        "A navigator is reviewing your case. They can help you understand your options.",
        es: "Un navegador está revisando tu caso. Pueden ayudarte a entender tus opciones.",
        zh: "导航员正在审核你的案例。他们可以帮你了解你的选择。",
        vi: "Một nhân viên hỗ trợ đang xem xét hồ sơ của bạn. Họ có thể giúp bạn hiểu các lựa chọn của mình.",
        tl: "May navigator na nagre-review ng iyong kaso. Matutulungan ka nilang maintindihan ang iyong mga opsyon."
    )
    static let navigatorOutreachScheduled = CivicaText(
        "Navigator outreach scheduled — we'll text you when they call.",
        es: "Contacto del navegador programado — te enviaremos un mensaje cuando llamen.",
        zh: "导航员联系已安排 — 他们打电话时我们会发短信通知你。",
        vi: "Đã lên lịch nhân viên hỗ trợ liên hệ — chúng tôi sẽ nhắn tin cho bạn khi họ gọi.",
        tl: "Naka-iskedyul na ang pakikipag-ugnayan ng navigator — ite-text ka namin kapag tatawag sila."
    )
    static let seeFullBenefitBreakdown = CivicaText(
        "See full benefit breakdown",
        es: "Ver desglose completo del beneficio",
        zh: "查看完整福利明细",
        vi: "Xem chi tiết đầy đủ về trợ cấp",
        tl: "Tingnan ang buong breakdown ng benepisyo"
    )
    static let reportAProblem = CivicaText(
        "Report a problem",
        es: "Reportar un problema",
        zh: "报告问题",
        vi: "Báo cáo sự cố",
        tl: "Mag-ulat ng problema"
    )

    // MARK: - MarketplaceEntryCard / PendingBenefitBanner

    static let pendingBenefitReassurance = CivicaText(
        "We'll have your amount within 24 hours. We'll text you.",
        es: "Tendremos tu monto en 24 horas. Te enviaremos un mensaje.",
        zh: "我们会在 24 小时内确定你的金额。届时会发短信通知你。",
        vi: "Chúng tôi sẽ có số tiền của bạn trong vòng 24 giờ. Chúng tôi sẽ nhắn tin cho bạn.",
        tl: "Malalaman namin ang halaga mo sa loob ng 24 oras. Ite-text ka namin."
    )

    // MARK: - JobMatchListView (deprecated Screen 02 wrapper)

    static let openHoursLine = CivicaText(
        "Open hours: M/W/F afternoons, T/Th evenings, weekends",
        es: "Horario: lunes/miércoles/viernes tardes, martes/jueves noches, fines de semana",
        zh: "营业时间:周一/三/五下午,周二/四晚上,周末",
        vi: "Giờ làm việc: chiều Thứ Hai/Tư/Sáu, tối Thứ Ba/Năm, cuối tuần",
        tl: "Oras na bukas: hapon ng Lunes/Miyerkules/Biyernes, gabi ng Martes/Huwebes, weekend"
    )
    static let beforeBenefitChanges = CivicaText(
        "before benefit changes",
        es: "antes de cambios en el beneficio",
        zh: "超过此金额你的福利会变动",
        vi: "trước khi trợ cấp thay đổi",
        tl: "bago magbago ang benepisyo"
    )
    static let rankingFramingCopy = CivicaText(
        "We rank jobs by what's best for your income, not what's best for employers.",
        es: "Ordenamos los empleos según lo mejor para tus ingresos, no para los empleadores.",
        zh: "我们按对你收入最有利的方式给工作排序,而不是按对雇主最有利的方式。",
        vi: "Chúng tôi xếp hạng việc làm theo điều tốt nhất cho thu nhập của bạn, không phải tốt nhất cho chủ lao động.",
        tl: "Inaayos namin ang ranggo ng mga trabaho ayon sa pinakamabuti para sa iyong kita, hindi para sa mga employer."
    )

    // MARK: - ApplyHandoffSheet (deprecated Screen 04 wrapper)

    static func applyingTo(employerName: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Applying to \(employerName)"
        case .mandarin: return "正在向 \(employerName) 申请"
        case .spanish: return "Solicitando en \(employerName)"
        case .vietnamese: return "Đang nộp đơn vào \(employerName)"
        case .tagalog: return "Nag-a-apply sa \(employerName)"
        }
    }
    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消",
        vi: "Hủy",
        tl: "Kanselahin"
    )
    static func wellShareWith(employerName: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "We'll share the following with \(employerName)"
        case .mandarin: return "我们将与 \(employerName) 分享以下内容"
        case .spanish: return "Compartiremos lo siguiente con \(employerName)"
        case .vietnamese: return "Chúng tôi sẽ chia sẻ những thông tin sau với \(employerName)"
        case .tagalog: return "Ibabahagi namin ang mga sumusunod sa \(employerName)"
        }
    }
    static let handshakeEmployerSystem = CivicaText(
        "Handshake is the employer's system. Applying there means your application reaches the right person fast.",
        es: "Handshake es el sistema del empleador. Solicitar ahí hace que tu solicitud llegue a la persona correcta rápidamente.",
        zh: "Handshake 是雇主的系统。在那里申请能让你的申请尽快送到对的人手上。",
        vi: "Handshake là hệ thống của chủ lao động. Nộp đơn ở đó giúp đơn của bạn đến đúng người một cách nhanh chóng.",
        tl: "Ang Handshake ang sistema ng employer. Ang pag-apply doon ay nangangahulugang mabilis na makakarating sa tamang tao ang iyong aplikasyon."
    )
    static let dontShareBenefitAmount = CivicaText(
        "We don't share your benefit amount with employers.",
        es: "No compartimos tu monto de beneficio con los empleadores.",
        zh: "我们不会把你的福利金额分享给雇主。",
        vi: "Chúng tôi không chia sẻ số tiền trợ cấp của bạn với chủ lao động.",
        tl: "Hindi namin ibinabahagi sa mga employer ang halaga ng iyong benepisyo."
    )
    static let applyOnHandshake = CivicaText(
        "Apply on Handshake",
        es: "Solicitar en Handshake",
        zh: "在 Handshake 上申请",
        vi: "Nộp đơn trên Handshake",
        tl: "Mag-apply sa Handshake"
    )

    // MARK: - BenefitImpactView (deprecated Screen 03 wrapper)

    static func gigVariabilityNote(employerName: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "\(employerName) income changes monthly. We'll recalculate when each paycheck lands."
        case .mandarin: return "\(employerName) 的收入每月都会变动。每次工资到账时我们会重新计算。"
        case .spanish: return "Los ingresos de \(employerName) cambian cada mes. Recalcularemos cuando llegue cada cheque."
        case .vietnamese: return "Thu nhập từ \(employerName) thay đổi hằng tháng. Chúng tôi sẽ tính lại mỗi khi có kỳ lương về."
        case .tagalog: return "Nagbabago kada buwan ang kita mula sa \(employerName). Kakalkulahin namin ulit tuwing may dumarating na sahod."
        }
    }
    static let applyViaHandshake = CivicaText(
        "Apply via Handshake",
        es: "Solicitar vía Handshake",
        zh: "通过 Handshake 申请",
        vi: "Nộp đơn qua Handshake",
        tl: "Mag-apply sa pamamagitan ng Handshake"
    )

    // MARK: - SNAPEnrolledView (Screen 01)

    static let enrolledNavTitle = CivicaText(
        "You're enrolled",
        es: "Estás inscrito/a",
        zh: "你已成功登记",
        vi: "Bạn đã ghi danh",
        tl: "Naka-enroll ka na"
    )
    // Screen 01 error inline block (D3)
    static let benefitLoadErrorHeadline = CivicaText(
        "Couldn't load your benefit",
        es: "No se pudo cargar tu beneficio",
        zh: "无法加载你的福利信息",
        vi: "Không tải được trợ cấp của bạn",
        tl: "Hindi ma-load ang iyong benepisyo"
    )
    static let benefitLoadErrorBody = CivicaText(
        "Check your connection and try again.",
        es: "Verifica tu conexión e inténtalo de nuevo.",
        zh: "请检查你的网络连接,然后重试。",
        vi: "Hãy kiểm tra kết nối của bạn và thử lại.",
        tl: "Tingnan ang iyong koneksyon at subukan ulit."
    )
    static let retry = CivicaText(
        "Try again",
        es: "Intentar de nuevo",
        zh: "重试",
        vi: "Thử lại",
        tl: "Subukan ulit"
    )
    static let enrolledHeadline = CivicaText(
        "You're enrolled in SNAP",
        es: "Estás inscrito/a en SNAP",
        zh: "你已成功登记 SNAP",
        vi: "Bạn đã ghi danh vào SNAP",
        tl: "Naka-enroll ka na sa SNAP"
    )
    static let monthlyBenefit = CivicaText(
        "MONTHLY BENEFIT",
        es: "BENEFICIO MENSUAL",
        zh: "每月福利",
        vi: "TRỢ CẤP HÀNG THÁNG",
        tl: "BUWANANG BENEPISYO"
    )
    static let earnUpTo = CivicaText(
        "Earn up to $1,580/month and keep your full benefit",
        es: "Gana hasta $1,580/mes y conserva tu beneficio completo",
        zh: "每月最多可赚 $1,580,仍可保留全部福利",
        vi: "Kiếm tới $1,580/tháng mà vẫn giữ toàn bộ trợ cấp của bạn",
        tl: "Kumita ng hanggang $1,580/buwan at panatilihin ang buo mong benepisyo"
    )
    static let whatsNextBody = CivicaText(
        "We'll show you campus jobs that work around your classes, with the income impact already calculated.",
        es: "Te mostraremos empleos en el campus que se adapten a tus clases, conserven tu beneficio SNAP completo y cuenten como horas de trabajo OBBBA.",
        zh: "我们会给你推荐与课程不冲突的校园工作,并已经算好对收入的影响。",
        vi: "Chúng tôi sẽ cho bạn xem các công việc trong trường phù hợp với lịch học của bạn, đã tính sẵn ảnh hưởng đến thu nhập.",
        tl: "Ipapakita namin sa iyo ang mga trabaho sa campus na akma sa iyong mga klase, na nakatantiya na ang epekto sa kita."
    )

    // MARK: - SNAPJobImpactView (Screen 03)

    static let campusSuffix = CivicaText(
        " · Campus",
        es: " · Campus",
        zh: " · 校园",
        vi: " · Trong trường",
        tl: " · Campus"
    )
    static let hrPerWk = CivicaText(
        " hr/wk · $",
        es: " hr/semana · $",
        zh: " 小时/周 · $",
        vi: " giờ/tuần · $",
        tl: " oras/linggo · $"
    )
    static let hrRate = CivicaText(
        "/hr · ",
        es: "/hora · ",
        zh: "/小时 · ",
        vi: "/giờ · ",
        tl: "/oras · "
    )
    static let plusWeekends = CivicaText(
        " + weekends",
        es: " + fines de semana",
        zh: " + 周末",
        vi: " + cuối tuần",
        tl: " + weekend"
    )
    static let fwsExclusion = CivicaText(
        "FWS earnings would be $0 in this calculation — they're excluded by federal rule 7\u{00A0}CFR\u{00A0}273.9(c)(3).",
        es: "Los ingresos de FWS serían $0 en este cálculo, ya que están excluidos de la prueba de ingresos de SNAP según las reglas federales (7\u{00A0}CFR\u{00A0}273.9(c)(3)).",
        zh: "FWS(联邦工读)收入在此计算中按 $0 算 — 联邦规则 7\u{00A0}CFR\u{00A0}273.9(c)(3) 将其排除在外。",
        vi: "Thu nhập từ FWS sẽ là $0 trong phép tính này — chúng được loại trừ theo quy định liên bang 7\u{00A0}CFR\u{00A0}273.9(c)(3).",
        tl: "Magiging $0 ang kita mula sa FWS sa kalkulasyong ito — ibinubukod ang mga ito ng pederal na patakaran 7\u{00A0}CFR\u{00A0}273.9(c)(3)."
    )
    // Hardcoded demo value — passthrough (same in both languages)
    static let demoTotalIncome = CivicaText(
        "$1,393/month",
        es: "$1,393/mes",
        zh: "$1,393/月",
        vi: "$1,393/tháng",
        tl: "$1,393/buwan"
    )
    static let totalIncomeSuffix = CivicaText(
        " total income — $315 more than benefit alone.",
        es: " de ingresos totales — $315 más que solo el beneficio.",
        zh: " 总收入 — 比只靠福利多 $315。",
        vi: " tổng thu nhập — nhiều hơn $315 so với chỉ nhận trợ cấp.",
        tl: " kabuuang kita — $315 na mas malaki kaysa sa benepisyo lang."
    )
    static let footnoteEstimate = CivicaText(
        "Estimate based on your household of 2 and current shelter cost. Civica updates it monthly when you submit pay stubs.",
        es: "Estimación basada en tu hogar de 2 personas y la deducción de vivienda actual.",
        zh: "估算基于你 2 人的家庭和当前住房费用。你提交工资单后,Civica 每月会更新。",
        vi: "Ước tính dựa trên hộ gia đình 2 người của bạn và chi phí nhà ở hiện tại. Civica cập nhật hàng tháng khi bạn nộp phiếu lương.",
        tl: "Tantiya batay sa iyong sambahayan na 2 katao at kasalukuyang gastos sa tirahan. Ina-update ito ng Civica buwan-buwan kapag nagsumite ka ng pay stub."
    )
    // Screen 03 partial-error accessibility labels (D4)
    static let amountUnavailable = CivicaText(
        "Amount unavailable",
        es: "Cantidad no disponible",
        zh: "金额暂不可用",
        vi: "Số tiền tạm thời không có sẵn",
        tl: "Hindi available ang halaga"
    )
    static let totalIncomeUnavailable = CivicaText(
        "Total income unavailable",
        es: "Ingresos totales no disponibles",
        zh: "总收入暂不可用",
        vi: "Tổng thu nhập tạm thời không có sẵn",
        tl: "Hindi available ang kabuuang kita"
    )
}
