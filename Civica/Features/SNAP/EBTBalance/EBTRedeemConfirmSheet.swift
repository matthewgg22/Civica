import CivicaDesignSystem
import SwiftUI

// Self-attest redemption sheet — "Did you use this offer? How much did you save?"
//
// v1: self-attest only. User taps a savings preset (or types custom amount).
// v1.1: replaces the manual entry path with VisionKit receipt OCR.
//
// The sheet calls onConfirm(savingsCents) and dismisses. The caller is
// responsible for writing to EBTPerksStore.redeem() — this view has no
// network dependency.

struct EBTRedeemConfirmSheet: View {
    let offer: EBTOffer
    let language: CivicaLanguage
    let onConfirm: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var customDollars: String = ""
    @FocusState private var customFieldFocused: Bool

    private let presets: [Int] = [1_00, 2_00, 5_00, 10_00]

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(EBTPerksStrings.redeemConfirmTitle.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                    Text(EBTPerksStrings.redeemConfirmBody.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                }

                // Savings presets
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: CivicaSpacing.sm) {
                    ForEach(presets, id: \.self) { cents in
                        Button {
                            onConfirm(cents)
                            dismiss()
                        } label: {
                            Text("$\(cents / 100)")
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(CivicaColors.ink)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, CivicaSpacing.md)
                                .background(CivicaColors.surfacePrimary)
                                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                                .overlay(
                                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Custom amount
                HStack(spacing: CivicaSpacing.sm) {
                    Text("$")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.graphite)
                    TextField("0", text: $customDollars)
                        .keyboardType(.numberPad)
                        .font(CivicaTypography.subheadStrong)
                        .focused($customFieldFocused)
                    if let dollars = Int(customDollars), dollars > 0 {
                        Button {
                            onConfirm(dollars * 100)
                            dismiss()
                        } label: {
                            Text(EBTPerksStrings.redeemConfirmSaveButton.value(in: language))
                                .font(CivicaTypography.captionStrong)
                                .foregroundStyle(.white)
                                .padding(.horizontal, CivicaSpacing.md)
                                .padding(.vertical, 8)
                                .background(CivicaColors.pinePrimary)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .padding(CivicaSpacing.md)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(customFieldFocused ? CivicaColors.pinePrimary : CivicaColors.hairline, lineWidth: 1)
                )

                Spacer()
            }
            .padding(CivicaSpacing.xl)
            .navigationTitle(offer.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(EBTPerksStrings.redeemConfirmCancelButton.value(in: language)) {
                        dismiss()
                    }
                }
            }
        }
    }
}
