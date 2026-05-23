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
        es: "Se detectó un gasto inusual: compras grandes en los últimos 2 minutos."
    )

    /// Transaction flood alert: more than 5 transactions in 10 minutes.
    static let floodBannerCopy = CivicaText(
        "Multiple charges in a short time — please review your recent activity.",
        es: "Varios cargos en poco tiempo. Por favor, revisa tu actividad reciente."
    )

    /// Cross-state use alert: merchant appears to be outside California.
    static let crossStateBannerCopy = CivicaText(
        "Out-of-state purchase detected. If you're not traveling, your card may be compromised.",
        es: "Se detectó una compra fuera de California. Si no estás viajando, es posible que tu tarjeta esté comprometida."
    )

    // MARK: - Payday note

    /// Informational note shown when payday suppression is active.
    static let paydayNote = CivicaText(
        "Heads up: spending is often higher on benefit issuance days.",
        es: "Ten en cuenta: el gasto suele ser mayor en los días de depósito de beneficios."
    )

    // MARK: - Travel mute

    static let travelMuteCTA = CivicaText(
        "I'm traveling — mute alerts for 30 days",
        es: "Estoy viajando: silenciar alertas por 30 días"
    )

    static let travelMuteConfirm = CivicaText(
        "Out-of-state alerts muted for 30 days.",
        es: "Las alertas fuera del estado están silenciadas por 30 días."
    )

    static let travelMuteActive = CivicaText(
        "Travel mode active — out-of-state alerts muted.",
        es: "Modo de viaje activo: alertas fuera del estado silenciadas."
    )

    // MARK: - Detail view

    static let detailNavTitle = CivicaText(
        "Alert Details",
        es: "Detalles de la alerta"
    )

    static let detailTransactionsHeader = CivicaText(
        "Flagged transactions",
        es: "Transacciones marcadas"
    )

    static let detailActionsHeader = CivicaText(
        "What would you like to do?",
        es: "¿Qué deseas hacer?"
    )

    // MARK: - CTAs

    static let lockCardCTA = CivicaText(
        "Lock my card",
        es: "Bloquear mi tarjeta"
    )

    static let lockCardPlaceholder = CivicaText(
        "Card lock settings will appear here.",
        es: "Aquí aparecerán las opciones para bloquear la tarjeta."
    )

    static let reportFraudCTA = CivicaText(
        "Report fraud (1-877-328-9677)",
        es: "Reportar fraude (1-877-328-9677)"
    )

    static let dismissCTA = CivicaText(
        "Dismiss",
        es: "Descartar"
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
