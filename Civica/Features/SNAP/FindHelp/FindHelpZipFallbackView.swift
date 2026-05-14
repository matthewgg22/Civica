import CivicaDesignSystem
import CoreLocation
import SwiftUI

// Shown when the user has denied location access or tapped
// "Use a zip code instead" on the permission explainer. Geocodes
// the entered zip via CLGeocoder and triggers a store search at
// the resolved coordinate, then hands off to the map view.

struct FindHelpZipFallbackView: View {
    @ObservedObject var store: FindHelpStore
    /// Localizable.xcstrings key for the prompt label displayed above
    /// the zip field. Callers pass different keys so the prompt copy
    /// matches the path that led here (denied vs. user-initiated).
    let messageKey: String

    @State private var zipInput = ""
    @State private var isGeocoding = false
    @State private var geocodeError: String?

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: CivicaSpacing.xl)

            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(LocalizedStringKey(messageKey))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: CivicaSpacing.sm) {
                    TextField(
                        language == .english ? "ZIP code" : "Código postal",
                        text: $zipInput
                    )
                    .keyboardType(.numberPad)
                    .textContentType(.postalCode)
                    .font(CivicaTypography.body)
                    .padding(CivicaSpacing.sm)
                    .background(CivicaColors.paper)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                    )
                    .onChange(of: zipInput) { _, new in
                        geocodeError = nil
                        zipInput = String(new.filter(\.isNumber).prefix(5))
                    }

                    Button {
                        Task { await geocodeAndSearch() }
                    } label: {
                        if isGeocoding {
                            ProgressView()
                                .tint(.white)
                                .frame(width: 60)
                        } else {
                            Text(LocalizedStringKey("find_help.zip_fallback.cta"))
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(.white)
                                .frame(width: 60)
                        }
                    }
                    .disabled(zipInput.count < 5 || isGeocoding)
                    .padding(.vertical, CivicaSpacing.sm)
                    .padding(.horizontal, CivicaSpacing.md)
                    .background(zipInput.count < 5 ? CivicaColors.graphite : CivicaColors.brickPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                    .animation(.easeInOut(duration: 0.15), value: zipInput.count >= 5)
                }

                if let error = geocodeError {
                    Text(error)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.brickPrimary)
                }
            }
            .padding(.horizontal, CivicaSpacing.xl)

            Spacer(minLength: CivicaSpacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(CivicaColors.surfaceSecondary.ignoresSafeArea())
    }

    private func geocodeAndSearch() async {
        guard zipInput.count == 5 else { return }
        isGeocoding = true
        geocodeError = nil
        defer { isGeocoding = false }

        let geocoder = CLGeocoder()
        do {
            let placemarks = try await geocoder.geocodeAddressString(zipInput + " USA")
            guard let location = placemarks.first?.location else {
                geocodeError = language == .english
                    ? "ZIP code not found. Try another."
                    : "Código postal no encontrado. Intenta otro."
                return
            }
            store.requestSearch(for: location, precision: .coarse)
        } catch {
            geocodeError = language == .english
                ? "Couldn't look up that ZIP code. Check your connection."
                : "No se pudo buscar ese código postal. Revisa tu conexión."
        }
    }
}

#if DEBUG
struct FindHelpZipFallbackView_Previews: PreviewProvider {
    static var previews: some View {
        FindHelpZipFallbackView(
            store: FindHelpStore(),
            messageKey: "find_help.zip_fallback.prompt"
        )
    }
}
#endif
