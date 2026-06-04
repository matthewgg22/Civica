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
        es: "Recibos",
        zh: "收据",
        vi: "Biên lai",
        tl: "Mga resibo"
    )
    static let detailScreenTitle = CivicaText(
        "Receipt detail",
        es: "Detalle del recibo",
        zh: "收据详情",
        vi: "Chi tiết biên lai",
        tl: "Detalye ng resibo"
    )
    static let confirmSheetTitle = CivicaText(
        "Confirm receipt",
        es: "Confirmar recibo",
        zh: "确认收据",
        vi: "Xác nhận biên lai",
        tl: "Kumpirmahin ang resibo"
    )

    // MARK: - Camera CTA

    static let scanReceiptButton = CivicaText(
        "Scan receipt",
        es: "Escanear recibo",
        zh: "扫描收据",
        vi: "Quét biên lai",
        tl: "I-scan ang resibo"
    )

    // MARK: - Upload / progress

    static let uploading = CivicaText(
        "Uploading receipt…",
        es: "Subiendo recibo…",
        zh: "正在上传收据…",
        vi: "Đang tải biên lai lên…",
        tl: "Ina-upload ang resibo…"
    )

    // MARK: - OCR confirm prompt (low confidence)

    static let lowConfidencePrompt = CivicaText(
        "We weren't sure we read this correctly. Please review and correct the details below.",
        es: "No estamos seguros de haber leído esto correctamente. Revise y corrija los detalles a continuación.",
        zh: "我们不太确定是否读取正确。请检查并更正下面的详细信息。",
        vi: "Chúng tôi không chắc đã đọc đúng. Vui lòng kiểm tra và sửa các chi tiết bên dưới.",
        tl: "Hindi kami sigurado kung tama ang nabasa namin. Pakitingnan at iwasto ang mga detalye sa ibaba."
    )

    // MARK: - Form field labels + placeholders

    static let merchantLabel = CivicaText(
        "Store / Merchant",
        es: "Tienda / Comercio",
        zh: "商店 / 商家",
        vi: "Cửa hàng / Nơi bán",
        tl: "Tindahan / Merchant"
    )
    static let merchantPlaceholder = CivicaText(
        "e.g. Walmart",
        es: "ej. Walmart",
        zh: "例如 Walmart",
        vi: "ví dụ Walmart",
        tl: "hal. Walmart"
    )
    static let totalLabel = CivicaText(
        "Total amount",
        es: "Monto total",
        zh: "总金额",
        vi: "Tổng số tiền",
        tl: "Kabuuang halaga"
    )
    static let totalPlaceholder = CivicaText(
        "e.g. 42.17",
        es: "ej. 42.17",
        zh: "例如 42.17",
        vi: "ví dụ 42.17",
        tl: "hal. 42.17"
    )

    // MARK: - Confirm / cancel actions

    static let confirmUploadButton = CivicaText(
        "Confirm & upload",
        es: "Confirmar y subir",
        zh: "确认并上传",
        vi: "Xác nhận và tải lên",
        tl: "Kumpirmahin at i-upload"
    )
    static let cancelButton = CivicaText(
        "Cancel",
        es: "Cancelar",
        zh: "取消",
        vi: "Hủy",
        tl: "Kanselahin"
    )

    // MARK: - Match status chips

    static let statusPendingMatch = CivicaText(
        "Matching…",
        es: "Emparejando…",
        zh: "匹配中…",
        vi: "Đang đối chiếu…",
        tl: "Itinutugma…"
    )
    static let statusMatched = CivicaText(
        "Matched",
        es: "Emparejado",
        zh: "已匹配",
        vi: "Đã đối chiếu",
        tl: "Naitugma"
    )
    static let statusAmbiguous = CivicaText(
        "Review needed",
        es: "Revisión necesaria",
        zh: "需要核对",
        vi: "Cần kiểm tra",
        tl: "Kailangang suriin"
    )
    static let statusStandalone = CivicaText(
        "No match",
        es: "Sin coincidencia",
        zh: "无匹配",
        vi: "Không khớp",
        tl: "Walang tugma"
    )

    // MARK: - Push copy for ambiguous match

    static let ambiguousMatchPushTitle = CivicaText(
        "Receipt needs your input",
        es: "Recibo requiere tu atención",
        zh: "收据需要你确认",
        vi: "Biên lai cần bạn xác nhận",
        tl: "May kailangan ang resibo mo"
    )
    static let ambiguousMatchPushBody = CivicaText(
        "Tap to confirm which transaction matches your recent receipt.",
        es: "Toca para confirmar qué transacción corresponde a tu recibo reciente.",
        zh: "点击确认哪笔交易对应你最近的收据。",
        vi: "Nhấn để xác nhận giao dịch nào khớp với biên lai gần đây của bạn.",
        tl: "I-tap para kumpirmahin kung aling transaksyon ang tumutugma sa kamakailan mong resibo."
    )

    // MARK: - List

    static let unknownMerchant = CivicaText(
        "Unknown merchant",
        es: "Comercio desconocido",
        zh: "未知商家",
        vi: "Nơi bán không xác định",
        tl: "Hindi kilalang merchant"
    )
    static let emptyListMessage = CivicaText(
        "No receipts yet. Scan one to attach it to a transaction.",
        es: "Sin recibos aún. Escanea uno para adjuntarlo a una transacción.",
        zh: "还没有收据。扫描一张以附加到某笔交易。",
        vi: "Chưa có biên lai nào. Quét một biên lai để đính kèm vào một giao dịch.",
        tl: "Wala pang resibo. Mag-scan ng isa para idikit ito sa isang transaksyon."
    )

    // MARK: - Detail view

    static let statusLabel = CivicaText(
        "Status",
        es: "Estado",
        zh: "状态",
        vi: "Trạng thái",
        tl: "Status"
    )
    static let editSectionTitle = CivicaText(
        "Receipt details",
        es: "Detalles del recibo",
        zh: "收据详情",
        vi: "Chi tiết biên lai",
        tl: "Mga detalye ng resibo"
    )
    static let transactionLinkTitle = CivicaText(
        "Linked transaction",
        es: "Transacción vinculada",
        zh: "已关联交易",
        vi: "Giao dịch đã liên kết",
        tl: "Naka-link na transaksyon"
    )
    static let noTransactionLinked = CivicaText(
        "No transaction linked yet.",
        es: "Aún no hay transacción vinculada.",
        zh: "尚未关联任何交易。",
        vi: "Chưa liên kết giao dịch nào.",
        tl: "Wala pang naka-link na transaksyon."
    )
    static let unlinkButton = CivicaText(
        "Unlink",
        es: "Desvincular",
        zh: "取消关联",
        vi: "Bỏ liên kết",
        tl: "Alisin ang link"
    )

    // MARK: - Settings labels

    static let settingsReceiptsTitle = CivicaText(
        "Receipts",
        es: "Recibos",
        zh: "收据",
        vi: "Biên lai",
        tl: "Mga resibo"
    )
    static let settingsReceiptsSubtitle = CivicaText(
        "Scan and attach receipts to transactions",
        es: "Escanea y adjunta recibos a transacciones",
        zh: "扫描收据并附加到交易",
        vi: "Quét và đính kèm biên lai vào giao dịch",
        tl: "Mag-scan at idikit ang mga resibo sa mga transaksyon"
    )

    // MARK: - Interpolated helpers

    static func linkedTransaction(id: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Linked to transaction \(id)…"
        case .mandarin: return "已关联到交易 \(id)…"
        case .spanish: return "Vinculado a transacción \(id)…"
        case .vietnamese: return "Đã liên kết với giao dịch \(id)…"
        case .tagalog: return "Naka-link sa transaksyon \(id)…"
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
