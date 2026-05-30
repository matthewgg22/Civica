import CivicaDesignSystem
import SwiftUI

// A list of captured receipts. Each row shows:
//   – merchant name (or "Unknown merchant" placeholder)
//   – capture date
//   – match-status chip (color-coded)
//
// Tapping a row navigates to EBTReceiptDetailView.

struct EBTReceiptListView: View {
    @ObservedObject var store: EBTReceiptsStore
    let language: CivicaLanguage

    var body: some View {
        Group {
            if store.repository.receipts.isEmpty {
                emptyState
            } else {
                receiptList
            }
        }
        .navigationTitle(EBTReceiptStrings.listScreenTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .task { try? await store.repository.refresh() }
    }

    // MARK: - Sub-views

    private var receiptList: some View {
        List(store.repository.receipts) { receipt in
            NavigationLink {
                EBTReceiptDetailView(receipt: receipt, store: store, language: language)
            } label: {
                receiptRow(receipt)
            }
            .accessibilityLabel(receipt.ocrMerchant ?? EBTReceiptStrings.unknownMerchant.value(in: language))
        }
        .listStyle(.insetGrouped)
    }

    private func receiptRow(_ receipt: EBTReceipt) -> some View {
        HStack(alignment: .center, spacing: CivicaSpacing.md) {
            Image(systemName: "doc.text.viewfinder")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 32, alignment: .center)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(receipt.ocrMerchant ?? EBTReceiptStrings.unknownMerchant.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                HStack(spacing: CivicaSpacing.sm) {
                    Text(receipt.capturedAt, style: .date)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                    matchChip(receipt.matchStatus, language: language)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var emptyState: some View {
        VStack(spacing: CivicaSpacing.lg) {
            Image(systemName: "doc.text.viewfinder")
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
            Text(EBTReceiptStrings.emptyListMessage.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(CivicaSpacing.xl)
    }
}

// MARK: - Match chip

private func matchChip(_ status: EBTReceiptMatchStatus, language: CivicaLanguage) -> some View {
    let (label, tint) = chipProps(for: status, language: language)
    return Text(label)
        .font(CivicaTypography.caption)
        .foregroundStyle(tint)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(tint.opacity(0.12))
        .clipShape(Capsule())
}

private func chipProps(for status: EBTReceiptMatchStatus, language: CivicaLanguage) -> (String, Color) {
    switch status {
    case .pendingMatch:
        return (EBTReceiptStrings.statusPendingMatch.value(in: language), CivicaColors.warningAmber)
    case .matched:
        return (EBTReceiptStrings.statusMatched.value(in: language), CivicaColors.pinePrimary)
    case .ambiguous:
        return (EBTReceiptStrings.statusAmbiguous.value(in: language), CivicaColors.warningAmber)
    case .standalone:
        return (EBTReceiptStrings.statusStandalone.value(in: language), CivicaColors.graphite)
    }
}
