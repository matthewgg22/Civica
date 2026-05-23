import Foundation

// String table for the EBT Push notifications + Notification Preferences
// surfaces. Populated by Lane D (T10) per the EBT Tracker Propel Parity
// plan §4.4 + §16.5. Every CivicaString MUST have both .en and .es —
// EBTStringParityTests guards drift at CI.
//
// Categories:
// - Pre-prompt: surfaced after first successful card link + first balance
//   render. Per D7, the system APNs prompt is only fired AFTER the user
//   taps "Yes" on this softer pre-prompt.
// - Settings deep-link: surfaced if the user previously hard-denied the
//   system prompt and we need them to flip the switch in iOS Settings.
// - Notification copy: titles + bodies for the four push categories
//   (deposit landed, low balance, re-link required, anomaly detected).
// - Prefs UI: labels for the user-facing notification preferences form
//   (per-category toggles + quiet hours).

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
        "Your benefits are on your card. Tap to see your new balance.",
        es: "Tus beneficios están en tu tarjeta. Toca para ver tu nuevo saldo."
    )

    static let lowBalanceTitle = CivicaText(
        "Your CalFresh balance is low",
        es: "Tu saldo de CalFresh está bajo"
    )
    static let lowBalanceBody = CivicaText(
        "Check your next deposit date and plan your shopping.",
        es: "Revisa la fecha de tu próximo depósito y planea tus compras."
    )

    static let reLinkTitle = CivicaText(
        "Re-link your EBT card",
        es: "Vuelve a conectar tu tarjeta EBT"
    )
    static let reLinkBody = CivicaText(
        "Your EBT session expired. Tap to reconnect and keep your balance up to date.",
        es: "Tu sesión de EBT expiró. Toca para reconectar y mantener tu saldo al día."
    )

    static let anomalyTitle = CivicaText(
        "Unusual activity on your card",
        es: "Actividad inusual en tu tarjeta"
    )
    static let anomalyBody = CivicaText(
        "We noticed a transaction that looks unusual. Tap to review it.",
        es: "Notamos una transacción que parece inusual. Toca para revisarla."
    )

    // MARK: - Notification preferences UI

    static let prefsScreenTitle = CivicaText(
        "Notifications",
        es: "Notificaciones"
    )

    static let depositToggle = CivicaText(
        "Deposit landed",
        es: "Depósito recibido"
    )
    static let depositToggleHelp = CivicaText(
        "Get notified the moment your CalFresh deposit hits your card.",
        es: "Recibe una notificación en el momento en que tu depósito de CalFresh llegue a tu tarjeta."
    )

    static let lowBalanceToggle = CivicaText(
        "Low balance",
        es: "Saldo bajo"
    )
    static let lowBalanceToggleHelp = CivicaText(
        "Warn me when my balance is running low for the month.",
        es: "Avísame cuando mi saldo esté bajo para el mes."
    )

    static let perksToggle = CivicaText(
        "Perks & discounts",
        es: "Beneficios y descuentos"
    )
    static let perksToggleHelp = CivicaText(
        "Free and discounted offers available with your EBT card.",
        es: "Ofertas gratuitas y con descuento disponibles con tu tarjeta EBT."
    )

    static let recertToggle = CivicaText(
        "Recertification reminders",
        es: "Recordatorios de recertificación"
    )
    static let recertToggleHelp = CivicaText(
        "Reminders before your CalFresh case needs to be renewed.",
        es: "Recordatorios antes de que tu caso de CalFresh necesite ser renovado."
    )

    static let quietHoursSectionTitle = CivicaText(
        "Quiet hours",
        es: "Horas de silencio"
    )
    static let quietHoursLabel = CivicaText(
        "Don't send notifications during these hours",
        es: "No enviar notificaciones durante estas horas"
    )
    static let quietStartLabel = CivicaText(
        "Start",
        es: "Inicio"
    )
    static let quietEndLabel = CivicaText(
        "End",
        es: "Fin"
    )
}
