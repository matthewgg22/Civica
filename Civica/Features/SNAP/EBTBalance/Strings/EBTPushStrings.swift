import CivicaDesignSystem
import Foundation

// String table for the EBT Push notifications + Notification Preferences
// surfaces. Populated by Lane D (T10) per the EBT Tracker Propel Parity
// plan §4.4 + §16.5. Every CivicaString MUST have both .en and .es —
// EBTStringParityTests guards drift at CI (registered via `all` per
// Lane C / plan §16.8).

enum EBTPushStrings {

    // MARK: - Just-in-time pre-prompt (per D7)

    static let prePromptTitle = CivicaText(
        "Get a heads-up when your deposit lands?",
        es: "¿Te avisamos cuando llegue tu depósito?",
        zh: "想在存款到账时收到提醒吗?",
        vi: "Bạn muốn được báo khi tiền về không?"
    )
    static let prePromptMessage = CivicaText(
        "Civica can send a notification the moment your CalFresh deposit hits your card — and warn you if your balance gets low. You can change this anytime in Settings.",
        es: "Civica puede enviarte una notificación en el momento en que tu depósito de CalFresh llegue a tu tarjeta — y avisarte si tu saldo está bajo. Puedes cambiar esto en cualquier momento en Configuración.",
        zh: "你的 CalFresh 存款一到卡上,Civica 就能立刻通知你 —— 余额不足时也会提醒你。你随时可以在「设置」里更改。",
        vi: "Civica có thể gửi thông báo ngay khi tiền CalFresh về thẻ của bạn — và cảnh báo khi số dư xuống thấp. Bạn có thể thay đổi điều này bất cứ lúc nào trong Cài đặt."
    )
    static let prePromptYes = CivicaText(
        "Yes, notify me",
        es: "Sí, notifícame",
        zh: "好,通知我",
        vi: "Có, hãy báo cho tôi"
    )
    static let prePromptLater = CivicaText(
        "Not now",
        es: "Ahora no",
        zh: "暂时不要",
        vi: "Không phải bây giờ"
    )

    // MARK: - Settings deep-link alert (after hard-deny)

    static let settingsAlertTitle = CivicaText(
        "Notifications are turned off",
        es: "Las notificaciones están desactivadas",
        zh: "通知已关闭",
        vi: "Thông báo đang bị tắt"
    )
    static let settingsAlertMessage = CivicaText(
        "To get deposit and low-balance alerts, turn on notifications for Civica in your iPhone Settings.",
        es: "Para recibir alertas de depósito y saldo bajo, activa las notificaciones para Civica en la Configuración de tu iPhone.",
        zh: "想收到存款和余额不足的提醒,请在 iPhone 的「设置」里为 Civica 打开通知。",
        vi: "Để nhận cảnh báo tiền về và số dư thấp, hãy bật thông báo cho Civica trong Cài đặt iPhone của bạn."
    )
    static let settingsAlertGoToSettings = CivicaText(
        "Open Settings",
        es: "Abrir Configuración",
        zh: "打开设置",
        vi: "Mở Cài đặt"
    )
    static let settingsAlertCancel = CivicaText(
        "Not now",
        es: "Ahora no",
        zh: "暂时不要",
        vi: "Không phải bây giờ"
    )

    // MARK: - Notification copy

    static let depositLandedTitle = CivicaText(
        "Your CalFresh deposit landed",
        es: "Tu depósito de CalFresh llegó",
        zh: "你的 CalFresh 存款已到账",
        vi: "Tiền CalFresh của bạn đã về"
    )
    static let depositLandedBody = CivicaText(
        "Tap to see your new balance.",
        es: "Toca para ver tu nuevo saldo.",
        zh: "点一下查看新余额。",
        vi: "Chạm để xem số dư mới của bạn."
    )

    static let lowBalanceTitle = CivicaText(
        "Your CalFresh balance is low",
        es: "Tu saldo de CalFresh está bajo",
        zh: "你的 CalFresh 余额不足",
        vi: "Số dư CalFresh của bạn đang thấp"
    )
    static let lowBalanceBody = CivicaText(
        "Tap to check your balance and see when your next deposit lands.",
        es: "Toca para ver tu saldo y cuándo llegará tu próximo depósito.",
        zh: "点一下查看余额,并了解下一次存款什么时候到账。",
        vi: "Chạm để kiểm tra số dư và xem khi nào lần nạp tiền tiếp theo về."
    )

    static let reLinkTitle = CivicaText(
        "Re-link your EBT card",
        es: "Vuelve a vincular tu tarjeta EBT",
        zh: "重新绑定你的 EBT 卡",
        vi: "Liên kết lại thẻ EBT của bạn"
    )
    static let reLinkBody = CivicaText(
        "Your card link expired. Tap to re-connect so Civica can keep checking your balance.",
        es: "El enlace de tu tarjeta expiró. Toca para volver a conectarla y que Civica siga verificando tu saldo.",
        zh: "你的卡片绑定已过期。点一下重新连接,让 Civica 可以继续帮你查余额。",
        vi: "Liên kết thẻ của bạn đã hết hạn. Chạm để kết nối lại để Civica có thể tiếp tục kiểm tra số dư cho bạn."
    )

    static let anomalyTitle = CivicaText(
        "Possible out-of-state EBT use",
        es: "Posible uso de EBT fuera del estado",
        zh: "可能存在跨州使用 EBT 的情况",
        vi: "Có thể có giao dịch EBT ngoài tiểu bang"
    )
    static let anomalyBody = CivicaText(
        "We noticed a transaction that might not be yours. Tap to review and lock your card if needed.",
        es: "Notamos una transacción que podría no ser tuya. Toca para revisar y bloquear tu tarjeta si es necesario.",
        zh: "我们发现一笔可能不是你本人发起的交易。点一下查看,必要时可以锁定你的卡。",
        vi: "Chúng tôi nhận thấy một giao dịch có thể không phải của bạn. Chạm để xem lại và khóa thẻ nếu cần."
    )

    // MARK: - Notification preferences UI

    static let prefsScreenTitle = CivicaText("Notifications", es: "Notificaciones", zh: "通知", vi: "Thông báo")
    static let depositToggle = CivicaText("Deposit landed", es: "Depósito llegó", zh: "存款到账", vi: "Tiền đã về")
    static let depositToggleHelp = CivicaText(
        "Notify me the moment my benefits arrive.",
        es: "Notifícame en el momento en que lleguen mis beneficios.",
        zh: "我的福利一到账就通知我。",
        vi: "Báo cho tôi ngay khi quyền lợi của tôi về."
    )
    static let lowBalanceToggle = CivicaText("Low balance", es: "Saldo bajo", zh: "余额不足", vi: "Số dư thấp")
    static let lowBalanceToggleHelp = CivicaText(
        "Warn me when my balance is running low for the month.",
        es: "Avísame cuando mi saldo esté bajo para el mes.",
        zh: "当我这个月的余额快不够时提醒我。",
        vi: "Cảnh báo cho tôi khi số dư của tôi sắp hết trong tháng."
    )
    static let perksToggle = CivicaText("Perks & discounts", es: "Beneficios y descuentos", zh: "福利与折扣", vi: "Ưu đãi & giảm giá")
    static let perksToggleHelp = CivicaText(
        "Free and discounted offers available with your EBT card.",
        es: "Ofertas gratuitas y con descuento disponibles con tu tarjeta EBT.",
        zh: "用你的 EBT 卡可享受的免费和折扣优惠。",
        vi: "Các ưu đãi miễn phí và giảm giá có sẵn với thẻ EBT của bạn."
    )
    static let recertToggle = CivicaText("Recertification reminders", es: "Recordatorios de recertificación", zh: "重新认证提醒", vi: "Nhắc tái xác nhận")
    static let recertToggleHelp = CivicaText(
        "Reminders before your CalFresh case needs to be renewed.",
        es: "Recordatorios antes de que tu caso de CalFresh necesite ser renovado.",
        zh: "在你的 CalFresh 案件需要续期前提醒你。",
        vi: "Nhắc nhở trước khi hồ sơ CalFresh của bạn cần được gia hạn."
    )
    static let quietHoursSectionTitle = CivicaText("Quiet hours", es: "Horas de silencio", zh: "免打扰时段", vi: "Giờ yên lặng")
    static let quietHoursLabel = CivicaText(
        "Don't send notifications during these hours",
        es: "No enviar notificaciones durante estas horas",
        zh: "在这些时段不发送通知",
        vi: "Không gửi thông báo trong những giờ này"
    )
    static let quietStartLabel = CivicaText("Start", es: "Inicio", zh: "开始", vi: "Bắt đầu")
    static let quietEndLabel = CivicaText("End", es: "Fin", zh: "结束", vi: "Kết thúc")

    /// Curated list of every CivicaText in this namespace. Registered for
    /// EBTStringParityTests (plan §16.8) per Lane C's convention.
    static let all: [CivicaText] = [
        prePromptTitle, prePromptMessage, prePromptYes, prePromptLater,
        settingsAlertTitle, settingsAlertMessage, settingsAlertGoToSettings, settingsAlertCancel,
        depositLandedTitle, depositLandedBody,
        lowBalanceTitle, lowBalanceBody,
        reLinkTitle, reLinkBody,
        anomalyTitle, anomalyBody,
        prefsScreenTitle,
        depositToggle, depositToggleHelp,
        lowBalanceToggle, lowBalanceToggleHelp,
        perksToggle, perksToggleHelp,
        recertToggle, recertToggleHelp,
        quietHoursSectionTitle, quietHoursLabel,
        quietStartLabel, quietEndLabel,
    ]
}
