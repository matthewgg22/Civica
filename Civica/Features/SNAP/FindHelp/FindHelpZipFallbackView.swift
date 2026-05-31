import CivicaDesignSystem
import CoreLocation
import SwiftUI

/// Zip-code entry path used when the user declines location sharing or
/// the system denies it. Seeds `FindHelpStore` with a coordinate derived
/// from the geocoded zip so the rest of the map flow works unchanged.
struct FindHelpZipFallbackView: View {
    @ObservedObject var store: FindHelpStore
    let messageKey: LocalizedStringKey

    @State private var zip: String = ""
    @State private var isGeocoding: Bool = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        VStack(spacing: CivicaSpacing.lg) {
            Text(messageKey)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.graphite)
                .multilineTextAlignment(.center)

            HStack(spacing: CivicaSpacing.sm) {
                TextField("ZIP code", text: $zip)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 160)

                Button {
                    submit()
                } label: {
                    Text("find_help.zip_fallback.cta")
                }
                .buttonStyle(.borderedProminent)
                .disabled(zip.count < 5 || isGeocoding)
                .accessibilityLabel(language == .english ? "Search by ZIP code" : "Buscar por código postal")
            }

            if let error = store.error {
                Text(error.errorDescription ?? "Search failed.")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.destructive)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func submit() {
        let trimmed = zip.trimmingCharacters(in: .whitespaces)
        guard trimmed.count == 5 else { return }
        FindHelpAnalytics.trackZipFallbackUsed()
        isGeocoding = true
        Task {
            let geocoder = GeocodingService()
            do {
                let coordinate = try await geocoder.geocodeZipOrCity(trimmed)
                let location = CLLocation(
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude
                )
                await MainActor.run {
                    isGeocoding = false
                    store.userLocation = location
                    store.searchNearby(
                        lat: coordinate.latitude,
                        lng: coordinate.longitude,
                        radiusKm: store.currentRadiusKm
                    )
                }
            } catch {
                await MainActor.run {
                    isGeocoding = false
                    store.error = .locationUnavailable
                }
            }
        }
    }
}
