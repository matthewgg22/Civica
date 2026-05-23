import CivicaDesignSystem
import SwiftUI

// Shown when OCR confidence < 0.7. The recipient can correct the
// merchant name and/or total before the upload proceeds.

struct EBTReceiptConfirmSheet: View {
    let image: UIImage
    let pending: EBTReceipt
    @ObservedObject var store: EBTReceiptsStore
    let language: CivicaLanguage

    @State private var merchantText: String
    @State private var totalText: String

    init(image: UIImage, pending: EBTReceipt, store: EBTReceiptsStore, language: CivicaLanguage) {
        self.image = image
        self.pending = pending
        self.store = store
        self.language = language
        _merchantText = State(initialValue: pending.ocrMerchant ?? "")
        _totalText = State(initialValue: pending.ocrTotalCents.map { formatCents($0) } ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    // Receipt image thumbnail
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 220)
                        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                        .frame(maxWidth: .infinity)

                    // Low-confidence prompt
                    Text(EBTReceiptStrings.lowConfidencePrompt.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        Text(EBTReceiptStrings.merchantLabel.value(in: language))
                            .font(CivicaTypography.captionStrong)
                            .foregroundStyle(CivicaColors.graphite)
                        TextField(
                            EBTReceiptStrings.merchantPlaceholder.value(in: language),
                            text: $merchantText
                        )
                        .textFieldStyle(.roundedBorder)
                        .submitLabel(.next)
                    }

                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        Text(EBTReceiptStrings.totalLabel.value(in: language))
                            .font(CivicaTypography.captionStrong)
                            .foregroundStyle(CivicaColors.graphite)
                        TextField(
                            EBTReceiptStrings.totalPlaceholder.value(in: language),
                            text: $totalText
                        )
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.decimalPad)
                    }

                    Button {
                        Task {
                            await store.confirmAndUpload(
                                image: image,
                                merchant: merchantText.isEmpty ? nil : merchantText,
                                totalCents: parseCents(totalText)
                            )
                        }
                    } label: {
                        Label(
                            EBTReceiptStrings.confirmUploadButton.value(in: language),
                            systemImage: "checkmark"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(CivicaColors.pinePrimary)
                    .disabled(store.isUploading)
                }
                .padding(CivicaSpacing.xl)
            }
            .navigationTitle(EBTReceiptStrings.confirmSheetTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(EBTReceiptStrings.cancelButton.value(in: language)) {
                        store.cancelConfirm()
                    }
                }
            }
        }
    }
}

// MARK: - Helpers

private func formatCents(_ cents: Int) -> String {
    let dollars = cents / 100
    let remainder = cents % 100
    return String(format: "%d.%02d", dollars, remainder)
}

private func parseCents(_ text: String) -> Int? {
    let cleaned = text.replacingOccurrences(of: "$", with: "")
    guard let value = Double(cleaned), value >= 0 else { return nil }
    return Int(round(value * 100))
}
