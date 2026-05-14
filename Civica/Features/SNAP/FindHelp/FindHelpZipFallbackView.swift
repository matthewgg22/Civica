import CivicaDesignSystem
import CoreLocation
import SwiftUI

/// Zip-code entry path for users who decline location sharing (or whose
/// permission is denied/restricted). Geocodes a 5-digit US zip to a
/// coordinate, seeds it into `FindHelpStore`, and kicks off the same
/// nearby search the CoreLocation stream would. HANDOFF map · B1 calls
/// this out as a first-class alternative, not a degraded fallback.
struct FindHelpZipFallbackView: View {
    @ObservedObject var store: FindHelpStore
    let language: CivicaLanguage

    @State private var zip: String = ""
    @State private var isGeocoding = false
    @State private var errorMessage: String?

    private let geocoder = CLGeocoder()

    var body: some View {
        VStack(spacing: CivicaSpacing.lg) {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(FindHelpStrings.zipFallbackEyebrow.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(FindHelpStrings.zipFallbackPrompt.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)

                TextField(
                    FindHelpStrings.zipFallbackFieldLabel.value(in: language),
                    text: $zip
                )
                .keyboardType(.numberPad)
                .textContentType(.postalCode)
                .font(CivicaTypography.body)
                .padding(CivicaSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(CivicaColors.surfaceSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
                .onChange(of: zip) { _, newValue in
                    let digits = newValue.filter(\.isNumber)
                    zip = String(digits.prefix(5))
                    errorMessage = nil
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Button(action: search) {
                    Text(FindHelpStrings.zipFallbackSearchCTA.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(zip.count == 5 ? CivicaColors.brickPrimary : CivicaColors.graphite.opacity(0.4))
                        )
                }
                .disabled(zip.count != 5 || isGeocoding)
                .padding(.top, CivicaSpacing.sm)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )

            FindHelpHumanPathRow(language: language)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func search() {
        guard zip.count == 5 else {
            errorMessage = FindHelpStrings.zipFallbackInvalid.value(in: language)
            return
        }
        isGeocoding = true
        errorMessage = nil
        geocoder.geocodeAddressString(zip) { placemarks, _ in
            isGeocoding = false
            guard let location = placemarks?.first?.location else {
                errorMessage = FindHelpStrings.zipFallbackNotFound.value(in: language)
                return
            }
            store.userLocation = location
            store.requestSearch(for: location)
        }
    }
}
