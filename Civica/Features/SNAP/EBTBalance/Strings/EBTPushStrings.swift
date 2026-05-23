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
        es: "¿Te avisamos cuando llegue tu depósito?"
    )
    static let prePromptMessage = CivicaText(
        "Civica can send a notification the moment your CalFresh deposit hits your card — and warn you if your balance gets low. You can change this anytime in Settings.",
        es: "Civica puede enviarte una notificación en el momento en que tu depósito de CalFresh llegue a tu tarjeta — y avisarte si tu saldo está bajo. Puedes cambiar esto en cualquier momento en Configuración."
    )
    static let prePromptYes = CivicaText(
        "Yes, notify me",
        es: "Sí, notifícame"
    )
    static let prePromptLater = CivicaText(
        "Not now",
        es: "Ahora no"
    )

    // MARK: - Settings deep-link alert (after hard-deny)

    static let settingsAlertTitle = CivicaText(
        "Notifications are turned off",
        es: "Las notificaciones están desactivadas"
    )
    static let settingsAlertMessage = CivicaText(
        "To get deposit and low-balance alerts, turn on notifications for Civica in your iPhone Settings.",
        es: "Para recibir alertas de depósito y saldo bajo, activa las notificaciones para Civica en la Configuración de tu iPhone."
    )
    static let settingsAlertGoToSettings = CivicaText(
        "Open Settings",
        es: "Abrir Configuración"
    )
    static let settingsAlertCancel = CivicaText(
        "Not now",
        es: "Ahora no"
    )

    // MARK: - Notification copy

    static let depositLandedTitle = CivicaText(
        "Your CalFresh deposit landed",
        es: "Tu depósito de CalFresh llegó"
    )
    static let depositLandedBody = CivicaText(
        "Tap to see your new balance.",
        es: "Toca para ver tu nuevo saldo."
    )

    static let lowBalanceTitle = CivicaText(
        "Your CalFresh balance is low",
        es: "Tu saldo de CalFresh está bajo"
    )
    static let lowBalanceBody = CivicaText(
        "Tap to check your balance and see when your next deposit lands.",
        es: "Toca para ver tu saldo y cuándo llegará tu próximo depósito."
    )

    static let reLinkTitle = CivicaText(
        "Re-link your EBT card",
        es: "Vuelve a vincular tu tarjeta EBT"
    )
    static let reLinkBody = CivicaText(
        "Your card link expired. Tap to re-connect so Civica can keep checking your balance.",
        es: "El enlace de tu tarjeta expiró. Toca para volver a conectarla y que Civica siga verificando tu saldo."
    )

    static let anomalyTitle = CivicaText(
        "Possible out-of-state EBT use",
        es: "Posible uso de EBT fuera del estado"
    )
    static let anomalyBody = CivicaText(
        "We noticed a transaction that might not be yours. Tap to review and lock your card if needed.",
        es: "Notamos una transacción que podría no ser tuya. Toca para revisar y bloquear tu tarjeta si es necesario."
    )

    // MARK: - Notification preferences UI

    static let prefsScreenTitle = CivicaText("Notifications", es: "Notificaciones")
    static let depositToggle = CivicaText("Deposit landed", es: "Depósito llegó")
    static let depositToggleHelp = CivicaText(
        "Notify me the moment my benefits arrive.",
        es: "Notifícame en el momento en que lleguen mis beneficios."
    )
    static let lowBalanceToggle = CivicaText("Low balance", es: "Saldo bajo")
    static let lowBalanceToggleHelp = CivicaText(
        "Warn me when my balance is running low for the month.",
        es: "Avísame cuando mi saldo esté bajo para el mes."
    )
    static let perksToggle = CivicaText("Perks & discounts", es: "Beneficios y descuentos")
    static let perksToggleHelp = CivicaText(
        "Free and discounted offers available with your EBT card.",
        es: "Ofertas gratuitas y con descuento disponibles con tu tarjeta EBT."
    )
    static let recertToggle = CivicaText("Recertification reminders", es: "Recordatorios de recertificación")
    static let recertToggleHelp = CivicaText(
        "Reminders before your CalFresh case needs to be renewed.",
        es: "Recordatorios antes de que tu caso de CalFresh necesite ser renovado."
    )
    static let quietHoursSectionTitle = CivicaText("Quiet hours", es: "Horas de silencio")
    static let quietHoursLabel = CivicaText(
        "Don't send notifications during these hours",
        es: "No enviar notificaciones durante estas horas"
    )
    static let quietStartLabel = CivicaText("Start", es: "Inicio")
    static let quietEndLabel = CivicaText("End", es: "Fin")

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
