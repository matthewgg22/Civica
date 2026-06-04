import CivicaDesignSystem

// Anomaly / skimming-alert copy for the Check EBT Balance feature.
// Populated by Phase 2 (T18) — velocity-burst banner, out-of-state
// merchant warning, travel-mute confirmation, escalation-to-county
// CTA.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI
// otherwise.

enum EBTAnomalyStrings {

    // MARK: - Banner copy (shown in EBTAnomalyBannerView)

    /// Velocity burst alert: more than $50 in 2 minutes.
    static let velocityBannerCopy = CivicaText(
        "Unusual spending detected — large purchases in the last 2 minutes.",
        es: "Se detectó un gasto inusual: compras grandes en los últimos 2 minutos.",
        zh: "检测到异常消费 — 最近 2 分钟内有大额购买。",
        vi: "Phát hiện chi tiêu bất thường — có giao dịch mua lớn trong 2 phút vừa qua.",
        tl: "May natuklasang hindi pangkaraniwang paggastos — malalaking bili sa nakaraang 2 minuto."
    )

    /// Transaction flood alert: more than 5 transactions in 10 minutes.
    static let floodBannerCopy = CivicaText(
        "Multiple charges in a short time — please review your recent activity.",
        es: "Varios cargos en poco tiempo. Por favor, revisa tu actividad reciente.",
        zh: "短时间内出现多笔扣款 — 请查看你最近的交易记录。",
        vi: "Có nhiều khoản trừ tiền trong thời gian ngắn — vui lòng xem lại hoạt động gần đây của bạn.",
        tl: "Maraming singil sa maikling panahon — pakitingnan ang iyong mga kamakailang transaksyon."
    )

    /// Cross-state use alert: merchant appears to be outside California.
    static let crossStateBannerCopy = CivicaText(
        "Out-of-state purchase detected. If you're not traveling, your card may be compromised.",
        es: "Se detectó una compra fuera de California. Si no estás viajando, es posible que tu tarjeta esté comprometida.",
        zh: "检测到加州以外的消费。如果你没有外出旅行,你的卡可能已被盗用。",
        vi: "Phát hiện giao dịch mua ngoài tiểu bang. Nếu bạn không đi du lịch, thẻ của bạn có thể đã bị xâm phạm.",
        tl: "May natuklasang bili sa labas ng estado. Kung hindi ka naglalakbay, maaaring na-compromise ang iyong card."
    )

    // MARK: - Payday note

    /// Informational note shown when payday suppression is active.
    static let paydayNote = CivicaText(
        "Heads up: spending is often higher on benefit issuance days.",
        es: "Ten en cuenta: el gasto suele ser mayor en los días de depósito de beneficios.",
        zh: "提示:福利发放当天的消费通常会更高。",
        vi: "Lưu ý: chi tiêu thường cao hơn vào những ngày nhận trợ cấp.",
        tl: "Paalala: kadalasang mas mataas ang paggastos sa mga araw na nilalabas ang benepisyo."
    )

    // MARK: - Travel mute

    static let travelMuteCTA = CivicaText(
        "I'm traveling — mute alerts for 30 days",
        es: "Estoy viajando: silenciar alertas por 30 días",
        zh: "我在旅行中 — 静音提醒 30 天",
        vi: "Tôi đang đi du lịch — tắt thông báo trong 30 ngày",
        tl: "Naglalakbay ako — i-mute ang mga alerto nang 30 araw"
    )

    static let travelMuteConfirm = CivicaText(
        "Out-of-state alerts muted for 30 days.",
        es: "Las alertas fuera del estado están silenciadas por 30 días.",
        zh: "州外消费提醒已静音 30 天。",
        vi: "Đã tắt thông báo ngoài tiểu bang trong 30 ngày.",
        tl: "Na-mute ang mga alerto sa labas ng estado nang 30 araw."
    )

    static let travelMuteActive = CivicaText(
        "Travel mode active — out-of-state alerts muted.",
        es: "Modo de viaje activo: alertas fuera del estado silenciadas.",
        zh: "旅行模式已开启 — 州外消费提醒已静音。",
        vi: "Chế độ du lịch đang bật — đã tắt thông báo ngoài tiểu bang.",
        tl: "Naka-on ang travel mode — na-mute ang mga alerto sa labas ng estado."
    )

    // MARK: - Detail view

    static let detailNavTitle = CivicaText(
        "Alert Details",
        es: "Detalles de la alerta",
        zh: "提醒详情",
        vi: "Chi tiết thông báo",
        tl: "Mga Detalye ng Alerto"
    )

    static let detailTransactionsHeader = CivicaText(
        "Flagged transactions",
        es: "Transacciones marcadas",
        zh: "被标记的交易",
        vi: "Các giao dịch bị đánh dấu",
        tl: "Mga na-flag na transaksyon"
    )

    static let detailActionsHeader = CivicaText(
        "What would you like to do?",
        es: "¿Qué deseas hacer?",
        zh: "你想怎么做?",
        vi: "Bạn muốn làm gì?",
        tl: "Ano ang gusto mong gawin?"
    )

    // MARK: - CTAs

    static let lockCardCTA = CivicaText(
        "Lock my card",
        es: "Bloquear mi tarjeta",
        zh: "锁定我的卡",
        vi: "Khóa thẻ của tôi",
        tl: "I-lock ang aking card"
    )

    static let lockCardPlaceholder = CivicaText(
        "Card lock settings will appear here.",
        es: "Aquí aparecerán las opciones para bloquear la tarjeta.",
        zh: "卡片锁定设置将显示在这里。",
        vi: "Cài đặt khóa thẻ sẽ hiển thị ở đây.",
        tl: "Lalabas dito ang mga setting para sa pag-lock ng card."
    )

    static let reportFraudCTA = CivicaText(
        "Report fraud (1-877-328-9677)",
        es: "Reportar fraude (1-877-328-9677)",
        zh: "举报欺诈 (1-877-328-9677)",
        vi: "Báo cáo gian lận (1-877-328-9677)",
        tl: "I-report ang panloloko (1-877-328-9677)"
    )

    static let dismissCTA = CivicaText(
        "Dismiss",
        es: "Descartar",
        zh: "忽略",
        vi: "Bỏ qua",
        tl: "I-dismiss"
    )

    // MARK: - Parity guard
    //
    // Every CivicaText in this enum MUST appear here so
    // EBTStringParityTests.everyEntryHasBothLanguages() can check EN/ES
    // drift at CI. Adding a new string → append to `all`.

    static let all: [CivicaText] = [
        velocityBannerCopy,
        floodBannerCopy,
        crossStateBannerCopy,
        paydayNote,
        travelMuteCTA,
        travelMuteConfirm,
        travelMuteActive,
        detailNavTitle,
        detailTransactionsHeader,
        detailActionsHeader,
        lockCardCTA,
        lockCardPlaceholder,
        reportFraudCTA,
        dismissCTA,
    ]
}
