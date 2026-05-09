import SwiftUI
import MapKit

// MARK: - MyRepsFullScreenMapView

struct MyRepsFullScreenMapView: View {
    let mapMode: MapMode
    let resolvedCoordinate: CLLocationCoordinate2D?
    let resolvedStateCode: String?
    let politicalGeography: PoliticalGeography?
    let mapViewportResetID: UUID
    let onStateTapped: (String) -> Void
    let onResetMap: () -> Void
    let onClose: () -> Void

    @Environment(\.locale) private var locale

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    var body: some View {
        ZStack(alignment: .top) {
            VoteNowColors.appBackground
                .ignoresSafeArea()

            MyRepsCoverageMapView(
                mapMode: mapMode,
                resolvedCoordinate: resolvedCoordinate,
                resolvedStateCode: resolvedStateCode,
                politicalGeography: politicalGeography,
                mapViewportResetID: mapViewportResetID,
                onStateTapped: onStateTapped
            )
            .ignoresSafeArea()

            HStack(spacing: 10) {
                Button {
                    onClose()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .frame(width: 34, height: 34)
                        .background(VoteNowColors.surfaceWhite.opacity(0.96))
                        .overlay(
                            Circle()
                                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                        )
                        .shadow(color: VoteNowColors.primaryText.opacity(0.08), radius: 3, x: 0, y: 1)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
                .accessibilityLabel(l("app.reps.map.close", "Close map"))

                Spacer(minLength: 0)

                if case .focused = mapMode {
                    Button("Reset map") {
                        onResetMap()
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(VoteNowColors.surfaceWhite.opacity(0.96))
                    .overlay(
                        Capsule()
                            .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                    )
                    .shadow(color: VoteNowColors.primaryText.opacity(0.08), radius: 3, x: 0, y: 1)
                    .clipShape(Capsule())
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 10)
        }
    }
}
