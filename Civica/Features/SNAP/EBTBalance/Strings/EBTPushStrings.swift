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
        vi: "Bạn muốn được báo trước khi tiền nạp vào không?"
    )
    static let prePromptMessage = CivicaText(
        "Civica can send a notification the moment your CalFresh deposit hits your card — and warn you if your balance gets low. You can change this anytime in Settings.",
        es: "Civica puede enviarte una notificación en el momento en que tu depósito de CalFresh llegue a tu tarjeta — y avisarte si tu saldo está bajo. Puedes cambiar esto en cualquier momento en Configuración.",
        vi: "Civica có thể gửi thông báo ngay khi tiền CalFresh được nạp vào thẻ của bạn — và báo cho bạn biết nếu số dư xuống thấp. Bạn có thể thay đổi điều này bất cứ lúc nào trong phần Cài đặt."
    )
    static let prePromptYes = CivicaText(
        "Yes, notify me",
        es: "Sí, notifícame",
        vi: "Có, hãy báo cho tôi"
    )
    static let prePromptLater = CivicaText(
        "Not now",
        es: "Ahora no",
        vi: "Để sau"
    )

    // MARK: - Settings deep-link alert (after hard-deny)

    static let settingsAlertTitle = CivicaText(
        "Notifications are turned off",
        es: "Las notificaciones están desactivadas",
        vi: "Thông báo đang tắt"
    )
    static let settingsAlertMessage = CivicaText(
        "To get deposit and low-balance alerts, turn on notifications for Civica in your iPhone Settings.",
        es: "Para recibir alertas de depósito y saldo bajo, activa las notificaciones para Civica en la Configuración de tu iPhone.",
        vi: "Để nhận cảnh báo tiền nạp và số dư thấp, hãy bật thông báo cho Civica trong phần Cài đặt iPhone của bạn."
    )
    static let settingsAlertGoToSettings = CivicaText(
        "Open Settings",
        es: "Abrir Configuración",
        vi: "Mở Cài đặt"
    )
    static let settingsAlertCancel = CivicaText(
        "Not now",
        es: "Ahora no",
        vi: "Để sau"
    )

    // MARK: - Notification copy

    static let depositLandedTitle = CivicaText(
        "Your CalFresh deposit landed",
        es: "Tu depósito de CalFresh llegó",
        vi: "Tiền CalFresh của bạn đã được nạp"
    )
    static let depositLandedBody = CivicaText(
        "Tap to see your new balance.",
        es: "Toca para ver tu nuevo saldo.",
        vi: "Nhấn để xem số dư mới của bạn."
    )

    static let lowBalanceTitle = CivicaText(
        "Your CalFresh balance is low",
        es: "Tu saldo de CalFresh está bajo",
        vi: "Số dư CalFresh của bạn đang thấp"
    )
    static let lowBalanceBody = CivicaText(
        "Tap to check your balance and see when your next deposit lands.",
        es: "Toca para ver tu saldo y cuándo llegará tu próximo depósito.",
        vi: "Nhấn để xem số dư của bạn và biết khi nào tiền nạp lần tới về."
    )

    static let reLinkTitle = CivicaText(
        "Re-link your EBT card",
        es: "Vuelve a vincular tu tarjeta EBT",
        vi: "Liên kết lại thẻ EBT của bạn"
    )
    static let reLinkBody = CivicaText(
        "Your card link expired. Tap to re-connect so Civica can keep checking your balance.",
        es: "El enlace de tu tarjeta expiró. Toca para volver a conectarla y que Civica siga verificando tu saldo.",
        vi: "Liên kết thẻ của bạn đã hết hạn. Nhấn để kết nối lại để Civica có thể tiếp tục kiểm tra số dư của bạn."
    )

    static let anomalyTitle = CivicaText(
        "Possible out-of-state EBT use",
        es: "Posible uso de EBT fuera del estado",
        vi: "Có thể có giao dịch EBT ngoài tiểu bang"
    )
    static let anomalyBody = CivicaText(
        "We noticed a transaction that might not be yours. Tap to review and lock your card if needed.",
        es: "Notamos una transacción que podría no ser tuya. Toca para revisar y bloquear tu tarjeta si es necesario.",
        vi: "Chúng tôi nhận thấy một giao dịch có thể không phải của bạn. Nhấn để xem lại và khóa thẻ nếu cần."
    )

    // MARK: - Notification preferences UI

    static let prefsScreenTitle = CivicaText("Notifications", es: "Notificaciones", vi: "Thông báo")
    static let depositToggle = CivicaText("Deposit landed", es: "Depósito llegó", vi: "Tiền đã nạp")
    static let depositToggleHelp = CivicaText(
        "Notify me the moment my benefits arrive.",
        es: "Notifícame en el momento en que lleguen mis beneficios.",
        vi: "Báo cho tôi ngay khi trợ cấp của tôi về."
    )
    static let lowBalanceToggle = CivicaText("Low balance", es: "Saldo bajo", vi: "Số dư thấp")
    static let lowBalanceToggleHelp = CivicaText(
        "Warn me when my balance is running low for the month.",
        es: "Avísame cuando mi saldo esté bajo para el mes.",
        vi: "Báo cho tôi khi số dư trong tháng sắp hết."
    )
    static let perksToggle = CivicaText("Perks & discounts", es: "Beneficios y descuentos", vi: "Ưu đãi & giảm giá")
    static let perksToggleHelp = CivicaText(
        "Free and discounted offers available with your EBT card.",
        es: "Ofertas gratuitas y con descuento disponibles con tu tarjeta EBT.",
        vi: "Các ưu đãi miễn phí và giảm giá có sẵn khi dùng thẻ EBT của bạn."
    )
    static let recertToggle = CivicaText("Recertification reminders", es: "Recordatorios de recertificación", vi: "Nhắc nhở tái chứng nhận")
    static let recertToggleHelp = CivicaText(
        "Reminders before your CalFresh case needs to be renewed.",
        es: "Recordatorios antes de que tu caso de CalFresh necesite ser renovado.",
        vi: "Nhắc nhở trước khi hồ sơ CalFresh của bạn cần được gia hạn."
    )
    static let quietHoursSectionTitle = CivicaText("Quiet hours", es: "Horas de silencio", vi: "Giờ yên lặng")
    static let quietHoursLabel = CivicaText(
        "Don't send notifications during these hours",
        es: "No enviar notificaciones durante estas horas",
        vi: "Không gửi thông báo trong những giờ này"
    )
    static let quietStartLabel = CivicaText("Start", es: "Inicio", vi: "Bắt đầu")
    static let quietEndLabel = CivicaText("End", es: "Fin", vi: "Kết thúc")

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
