import CivicaDesignSystem
import SwiftUI

// Full detail view for a single captured receipt. Lets the user:
//   – View the scanned image (via AsyncImage from the signed URL)
//   – Edit merchant name and total
//   – See and interact with the matched transaction (or tap to link/unlink)

struct EBTReceiptDetailView: View {
    let receipt: EBTReceipt
    @ObservedObject var store: EBTReceiptsStore
    let language: CivicaLanguage

    @State private var merchantText: String
    @State private var totalText: String

    init(receipt: EBTReceipt, store: EBTReceiptsStore, language: CivicaLanguage) {
        self.receipt = receipt
        self.store = store
        self.language = language
        _merchantText = State(initialValue: receipt.ocrMerchant ?? "")
        _totalText = State(
            initialValue: receipt.ocrTotalCents.map { formatCents($0) } ?? ""
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                receiptImage
                statusSection
                editSection
                matchSection
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(EBTReceiptStrings.detailScreenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Sub-views

    private var receiptImage: some View {
        AsyncImage(url: receipt.imageURL) { phase in
            switch phase {
            case .success(let img):
                img.resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            case .failure:
                imagePlaceholder(systemName: "photo.slash")
            default:
                imagePlaceholder(systemName: "doc.text.viewfinder")
                    .overlay(ProgressView())
            }
        }
        .frame(maxWidth: .infinity)
        .frame(maxHeight: 280)
    }

    private func imagePlaceholder(systemName: String) -> some View {
        RoundedRectangle(cornerRadius: CivicaRadius.card)
            .fill(CivicaColors.surfaceSecondary)
            .frame(height: 180)
            .overlay(
                Image(systemName: systemName)
                    .font(.system(size: 36))
                    .foregroundStyle(CivicaColors.graphite)
            )
    }

    private var statusSection: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Text(EBTReceiptStrings.statusLabel.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
            matchStatusBadge
        }
    }

    private var matchStatusBadge: some View {
        let label: String
        let tint: Color
        switch receipt.matchStatus {
        case .pendingMatch:
            label = EBTReceiptStrings.statusPendingMatch.value(in: language)
            tint = CivicaColors.warningAmber
        case .matched:
            label = EBTReceiptStrings.statusMatched.value(in: language)
            tint = CivicaColors.pinePrimary
        case .ambiguous:
            label = EBTReceiptStrings.statusAmbiguous.value(in: language)
            tint = CivicaColors.warningAmber
        case .standalone:
            label = EBTReceiptStrings.statusStandalone.value(in: language)
            tint = CivicaColors.graphite
        }
        return Text(label)
            .font(CivicaTypography.caption)
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
    }

    private var editSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(EBTReceiptStrings.editSectionTitle.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.1)

            LabeledContent(EBTReceiptStrings.merchantLabel.value(in: language)) {
                TextField(
                    EBTReceiptStrings.merchantPlaceholder.value(in: language),
                    text: $merchantText
                )
                .multilineTextAlignment(.trailing)
            }

            Divider()

            LabeledContent(EBTReceiptStrings.totalLabel.value(in: language)) {
                TextField(
                    EBTReceiptStrings.totalPlaceholder.value(in: language),
                    text: $totalText
                )
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var matchSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(EBTReceiptStrings.transactionLinkTitle.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.1)

            if let txId = receipt.transactionId {
                HStack {
                    Image(systemName: "link")
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .accessibilityHidden(true)
                    Text(EBTReceiptStrings.linkedTransaction(id: String(txId.prefix(8)), language: language))
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.ink)
                    Spacer()
                    Button(EBTReceiptStrings.unlinkButton.value(in: language)) {
                        // Phase 2: PATCH /ebt/receipts/:id { transaction_id: null }
                    }
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.brickAccent)
                    .accessibilityLabel(EBTReceiptStrings.unlinkButton.value(in: language))
                }
            } else {
                Text(EBTReceiptStrings.noTransactionLinked.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }
}

// MARK: - Helpers

private func formatCents(_ cents: Int) -> String {
    let dollars = cents / 100
    let remainder = cents % 100
    return String(format: "%d.%02d", dollars, remainder)
}
