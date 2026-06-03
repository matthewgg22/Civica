import CivicaDesignSystem

// Receipt-capture copy for the Check EBT Balance feature.
// Populated by Phase 2 (T16/T17) — VisionKit capture sheet, OCR
// confirmation, match-status banner, ambiguous-match picker, standalone-
// receipt detail.
//
// Every CivicaText added here MUST have both .en and .es. The
// EBTStringParityTests parity guard (plan §16.8) will fail in CI otherwise.

enum EBTReceiptStrings {
    // MARK: - Navigation / screen titles

    static let listScreenTitle = CivicaText(
        "Receipts",
        es: "Recibos"
    )
    static let detailScreenTitle = CivicaText(
        "Receipt detail",
        es: "Detalle del recibo"
    )
    static let confirmSheetTitle = CivicaText(
        "Confirm receipt",
        es: "Confirmar recibo"
    )

    // MARK: - Camera CTA

    static let scanReceiptButton = CivicaText(
        "Scan receipt",
        es: "Escanear recibo"
    )

    // MARK: - Upload / progress

    static let uploading = CivicaText(
        "Uploading receipt…",
        es: "Subiendo recibo…"
    )

    // MARK: - OCR confirm prompt (low confidence)

    static let lowConfidencePrompt = CivicaText(
        "We weren't sure we read this correctly. Please review and correct the details below.",
        es: "No estamos seguros de haber leído esto correctamente. Revise y corrija los detalles a continuación."
    )

    // MARK: - Form field labels + placeholders

    static let merchantLabel = CivicaText(
        "Store / Merchant",
        es: "Tienda / Comercio"
    )
    static let merchantPlaceholder = CivicaText(
        "e.g. Walmart",
        es: "ej. Walmart"
    )
    static let totalLabel = CivicaText(
        "Total amount",
        es: "Monto total"
    )
    static let totalPlaceholder = CivicaText(
        "e.g. 42.17",
        es: "ej. 42.17"
    )

    // MARK: - Confirm / cancel actions

    static let confirmUploadButton = CivicaText(
        "Confirm & upload",
        es: "Confirmar y subir"
    )
    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar"
    )

    // MARK: - Match status chips

    static let statusPendingMatch = CivicaText(
        "Matching…",
        es: "Emparejando…"
    )
    static let statusMatched = CivicaText(
        "Matched",
        es: "Emparejado"
    )
    static let statusAmbiguous = CivicaText(
        "Review needed",
        es: "Revisión necesaria"
    )
    static let statusStandalone = CivicaText(
        "No match",
        es: "Sin coincidencia"
    )

    // MARK: - Push copy for ambiguous match

    static let ambiguousMatchPushTitle = CivicaText(
        "Receipt needs your input",
        es: "Recibo requiere tu atención"
    )
    static let ambiguousMatchPushBody = CivicaText(
        "Tap to confirm which transaction matches your recent receipt.",
        es: "Toca para confirmar qué transacción corresponde a tu recibo reciente."
    )

    // MARK: - List

    static let unknownMerchant = CivicaText(
        "Unknown merchant",
        es: "Comercio desconocido"
    )
    static let emptyListMessage = CivicaText(
        "No receipts yet. Scan one to attach it to a transaction.",
        es: "Sin recibos aún. Escanea uno para adjuntarlo a una transacción."
    )

    // MARK: - Detail view

    static let statusLabel = CivicaText(
        "Status",
        es: "Estado"
    )
    static let editSectionTitle = CivicaText(
        "Receipt details",
        es: "Detalles del recibo"
    )
    static let transactionLinkTitle = CivicaText(
        "Linked transaction",
        es: "Transacción vinculada"
    )
    static let noTransactionLinked = CivicaText(
        "No transaction linked yet.",
        es: "Aún no hay transacción vinculada."
    )
    static let unlinkButton = CivicaText(
        "Unlink",
        es: "Desvincular"
    )

    // MARK: - Settings labels

    static let settingsReceiptsTitle = CivicaText(
        "Receipts",
        es: "Recibos"
    )
    static let settingsReceiptsSubtitle = CivicaText(
        "Scan and attach receipts to transactions",
        es: "Escanea y adjunta recibos a transacciones"
    )

    // MARK: - Interpolated helpers

    static func linkedTransaction(id: String, language: CivicaLanguage) -> String {
        switch language {
        case .english, .mandarin, .vietnamese, .tagalog: return "Linked to transaction \(id)…"
        case .spanish: return "Vinculado a transacción \(id)…"
        }
    }

    // MARK: - Parity guard list

    /// Curated list of every CivicaText in this namespace. Add new entries
    /// here so EBTStringParityTests catches EN/ES drift. See
    /// EBTBalanceStrings.all for the rationale.
    static let all: [CivicaText] = [
        listScreenTitle,
        detailScreenTitle,
        confirmSheetTitle,
        scanReceiptButton,
        uploading,
        lowConfidencePrompt,
        merchantLabel,
        merchantPlaceholder,
        totalLabel,
        totalPlaceholder,
        confirmUploadButton,
        cancelButton,
        statusPendingMatch,
        statusMatched,
        statusAmbiguous,
        statusStandalone,
        ambiguousMatchPushTitle,
        ambiguousMatchPushBody,
        unknownMerchant,
        emptyListMessage,
        statusLabel,
        editSectionTitle,
        transactionLinkTitle,
        noTransactionLinked,
        unlinkButton,
        settingsReceiptsTitle,
        settingsReceiptsSubtitle,
    ]
}
