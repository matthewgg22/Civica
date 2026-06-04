import CivicaDesignSystem

// State-directory copy for the Check EBT Balance feature's account
// services screen. Populated by Lane C (T13) — California-specific
// phone numbers and URLs for lost/stolen card, SNAP application,
// county office finder, and fraud reporting.
//
// Numbers + URLs live in EBTAccountServicesDirectory (the data layer);
// this file only owns recipient-facing labels and headers. New state
// launches (per plan §16.6) add their own directory entries; copy
// stays state-agnostic in EN+ES.
//
// Every CivicaText MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTAccountServicesStrings {
    static let screenTitle = CivicaText(
        "Account services",
        es: "Servicios de cuenta",
        zh: "账户服务",
        vi: "Dịch vụ tài khoản",
        tl: "Mga serbisyo sa account"
    )

    static let intro = CivicaText(
        "Direct lines to the agencies that handle your EBT card. Tap to call or open the right site — no menu trees, no hold music guesswork.",
        es: "Líneas directas a las agencias que manejan tu tarjeta EBT. Toca para llamar o abrir el sitio correcto — sin menús de teléfono, sin esperas adivinando.",
        zh: "直接联系处理你 EBT 卡的机构。点击拨打电话或打开正确的网站 — 没有菜单层级,不用猜测等待。",
        vi: "Đường dây trực tiếp đến các cơ quan xử lý thẻ EBT của bạn. Nhấn để gọi hoặc mở đúng trang web — không có menu nhiều tầng, không phải đoán mò khi chờ máy.",
        tl: "Direktang linya sa mga ahensiyang humahawak ng iyong EBT card. I-tap para tumawag o buksan ang tamang site — walang maraming menu, walang panghuhula habang naka-hold."
    )

    // MARK: - Section headers

    static let urgentSectionTitle = CivicaText(
        "Urgent",
        es: "Urgente",
        zh: "紧急",
        vi: "Khẩn cấp",
        tl: "Madalian"
    )
    static let benefitsSectionTitle = CivicaText(
        "Benefits & application",
        es: "Beneficios y solicitud",
        zh: "福利与申请",
        vi: "Trợ cấp và đơn xin",
        tl: "Benepisyo at aplikasyon"
    )
    static let reportingSectionTitle = CivicaText(
        "Report a problem",
        es: "Reportar un problema",
        zh: "报告问题",
        vi: "Báo cáo sự cố",
        tl: "Mag-ulat ng problema"
    )

    // MARK: - Row titles

    static let lostOrStolenCardTitle = CivicaText(
        "Lost or stolen card",
        es: "Tarjeta perdida o robada",
        zh: "卡丢失或被盗",
        vi: "Thẻ bị mất hoặc bị đánh cắp",
        tl: "Nawalang o ninakaw na card"
    )
    static let lostOrStolenCardHelp = CivicaText(
        "Call California EBT customer service. They lock your card immediately and mail a replacement.",
        es: "Llama al servicio al cliente de EBT de California. Bloquean tu tarjeta de inmediato y envían un reemplazo por correo.",
        zh: "拨打 California EBT 客服。他们会立即锁定你的卡,并邮寄一张替换卡。",
        vi: "Gọi dịch vụ khách hàng EBT của California. Họ sẽ khóa thẻ của bạn ngay lập tức và gửi thẻ thay thế qua đường bưu điện.",
        tl: "Tawagan ang customer service ng California EBT. Agad nilang ila-lock ang iyong card at magpapadala ng kapalit sa koreo."
    )

    static let applyForSNAPTitle = CivicaText(
        "Apply for SNAP via BenefitsCal",
        es: "Solicitar SNAP en BenefitsCal",
        zh: "通过 BenefitsCal 申请 SNAP",
        vi: "Xin SNAP qua BenefitsCal",
        tl: "Mag-apply ng SNAP sa BenefitsCal"
    )
    static let applyForSNAPHelp = CivicaText(
        "California's official benefits portal — start a new CalFresh application or check an existing one.",
        es: "El portal oficial de beneficios de California — comienza una nueva solicitud de CalFresh o revisa una existente.",
        zh: "California 官方福利门户 — 开始新的 CalFresh 申请或查看现有的申请。",
        vi: "Cổng trợ cấp chính thức của California — bắt đầu đơn xin CalFresh mới hoặc kiểm tra đơn hiện có.",
        tl: "Opisyal na benefits portal ng California — magsimula ng bagong CalFresh application o tingnan ang dati mong aplikasyon."
    )

    static let countyOfficeFinderTitle = CivicaText(
        "Local SNAP office finder",
        es: "Buscador de oficinas locales de SNAP",
        zh: "本地 SNAP 办公室查找",
        vi: "Tìm văn phòng SNAP tại địa phương",
        tl: "Hanapin ang lokal na SNAP office"
    )
    static let countyOfficeFinderHelp = CivicaText(
        "Find the CalFresh office in your county for in-person help, interviews, or document drop-off.",
        es: "Encuentra la oficina de CalFresh en tu condado para ayuda en persona, entrevistas o entrega de documentos.",
        zh: "找到你所在县的 CalFresh 办公室,获取面对面帮助、面试或递交文件。",
        vi: "Tìm văn phòng CalFresh trong county của bạn để được giúp đỡ trực tiếp, phỏng vấn hoặc nộp giấy tờ.",
        tl: "Hanapin ang CalFresh office sa iyong county para sa harapang tulong, interbyu, o pagsumite ng dokumento."
    )

    static let reportFraudTitle = CivicaText(
        "Report fraud",
        es: "Reportar fraude",
        zh: "举报欺诈",
        vi: "Báo cáo gian lận",
        tl: "Mag-ulat ng pandaraya"
    )
    static let reportFraudHelp = CivicaText(
        "Suspect someone is using your EBT card or your benefits were stolen? Report it to USDA.",
        es: "¿Sospechas que alguien está usando tu tarjeta EBT o que robaron tus beneficios? Repórtalo al USDA.",
        zh: "怀疑有人在使用你的 EBT 卡,或者你的福利被盗?向 USDA 举报。",
        vi: "Nghi ngờ có người đang dùng thẻ EBT của bạn hoặc trợ cấp của bạn bị đánh cắp? Hãy báo cáo cho USDA.",
        tl: "May pinaghihinalaan kang gumagamit ng iyong EBT card o ninakaw ang iyong benepisyo? I-ulat ito sa USDA."
    )

    // MARK: - Accessibility labels

    /// Spoken label for a "Tap to call" action. The view interpolates
    /// the row title (e.g. "Tap to call Lost or stolen card").
    static func callActionA11y(rowTitle: String, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return "Tap to call \(rowTitle)"
        case .mandarin:
            return "点击拨打 \(rowTitle)"
        case .spanish:
            return "Toca para llamar a \(rowTitle)"
        case .vietnamese:
            return "Nhấn để gọi \(rowTitle)"
        case .tagalog:
            return "I-tap para tawagan ang \(rowTitle)"
        }
    }

    /// Spoken label for "Tap to open in Safari".
    static func openLinkA11y(rowTitle: String, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return "Tap to open \(rowTitle) in Safari"
        case .mandarin:
            return "点击在 Safari 中打开 \(rowTitle)"
        case .spanish:
            return "Toca para abrir \(rowTitle) en Safari"
        case .vietnamese:
            return "Nhấn để mở \(rowTitle) trong Safari"
        case .tagalog:
            return "I-tap para buksan ang \(rowTitle) sa Safari"
        }
    }

    // MARK: - Parity introspection (see EBTBalanceStrings.all for rationale)

    static let all: [CivicaText] = [
        screenTitle, intro,
        urgentSectionTitle, benefitsSectionTitle, reportingSectionTitle,
        lostOrStolenCardTitle, lostOrStolenCardHelp,
        applyForSNAPTitle, applyForSNAPHelp,
        countyOfficeFinderTitle, countyOfficeFinderHelp,
        reportFraudTitle, reportFraudHelp,
    ]
}
