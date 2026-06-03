import CivicaDesignSystem
import MapKit
import SwiftUI

// HANDOFF map board A2 — "Pin tapped · peek."
//
// Compact bottom sheet shown when the user taps a map pin. Surfaces
// the minimum information needed to decide whether to drill into the
// full detail: name, service-type pill, address + distance, and a
// primary "View details" CTA. Tap anywhere outside the sheet to
// dismiss.
//
// Why not jump straight to the full detail sheet: per the canvas
// brief the peek lets users skim three or four pins quickly without
// re-mounting the full dense view every time. Reduced motion +
// reduced cognitive load.

struct FindHelpPeekSheet: View {
    let location: FindHelpLocation
    let language: CivicaLanguage
    let onViewDetails: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            servicePill
            Text(location.name)
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let line = addressLine {
                Text(line)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            chipStrip
            HStack(spacing: CivicaSpacing.sm) {
                // Primary: open Apple Maps for directions
                Button(action: openInMaps) {
                    Label(
                        language == .spanish ? "Cómo llegar" : "Get directions",
                        systemImage: "arrow.triangle.turn.up.right.circle.fill"
                    )
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.pinePrimary)
                    )
                }

                // Secondary: full detail sheet
                Button(action: onViewDetails) {
                    Text(language == .spanish ? "Más info" : "More info")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .frame(minWidth: 90, minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(CivicaColors.surfaceSecondary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .stroke(CivicaColors.hairline, lineWidth: 1)
                        )
                }
            }
            .padding(.top, CivicaSpacing.sm)
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.height(290)])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(CivicaRadius.card)
    }

    /// Brand-colored service-type pill — Brick / Teal / Graphite per
    /// the same palette as the map pins.
    private var servicePill: some View {
        let accent = pillColor
        return Text(pillLabel)
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .textCase(.uppercase)
            .kerning(0.5)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, 4)
            .background(accent)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.pill))
    }

    private func openInMaps() {
        guard let lat = location.latitude, let lng = location.longitude else { return }
        let placemark = MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
        let mapItem = MKMapItem(placemark: placemark)
        mapItem.name = location.name
        mapItem.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }

    /// Bridges the pin renderer's UIColor palette into SwiftUI so the
    /// peek pill matches the corresponding map pin exactly. Avoids a
    /// second source of truth for category colors.
    private var pillColor: Color {
        Color(uiColor: FindHelpPinPalette.color(for: location))
    }

    private var pillLabel: String {
        switch location.resolvedRecordKind {
        case .helpDirectory:
            switch (location.primaryServiceType, language) {
            case (.snapApplicationHelp, .english), (.snapApplicationHelp, .mandarin), (.snapApplicationHelp, .vietnamese), (.snapApplicationHelp, .tagalog): return "SNAP HELP"
            case (.snapApplicationHelp, .spanish): return "AYUDA CON SNAP"
            case (.foodAssistance, .english), (.foodAssistance, .mandarin), (.foodAssistance, .vietnamese), (.foodAssistance, .tagalog): return "FOOD"
            case (.foodAssistance,      .spanish): return "COMIDA"
            case (.both, .english), (.both, .mandarin), (.both, .vietnamese), (.both, .tagalog): return "SNAP + FOOD"
            case (.both,                .spanish): return "SNAP + COMIDA"
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket:    return FindHelpStrings.pillSupermarket.value(in: language)
            case .smallGrocer:    return FindHelpStrings.pillSmallGrocer.value(in: language)
            case .farmersMarket:  return FindHelpStrings.pillFarmersMarket.value(in: language)
            case .coOp:           return FindHelpStrings.pillCoOp.value(in: language)
            case .restaurantRMP:  return FindHelpStrings.pillRestaurantRMP.value(in: language)
            }
        }
    }

    /// Eligibility chips for retailer rows only — names exactly what
    /// payment methods work at this place. EBT is always shown for
    /// retailers (.ebtRetailer rows are by definition SNAP-accepting);
    /// WIC and HIP chips show only when the row carries those flags.
    @ViewBuilder
    private var chipStrip: some View {
        if location.resolvedRecordKind == .ebtRetailer {
            HStack(spacing: CivicaSpacing.xs) {
                chip(FindHelpStrings.chipEbt.value(in: language), background: CivicaColors.amberPrimary)
                if location.acceptsWic == true {
                    chip(FindHelpStrings.chipWic.value(in: language), background: CivicaColors.indigoStatus)
                }
                if location.acceptsHip == true {
                    chip(FindHelpStrings.chipHip.value(in: language), background: CivicaColors.warningAmber)
                }
            }
        }
    }

    private func chip(_ text: String, background: Color) -> some View {
        Text(text)
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.onPrimaryText)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, 3)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.pill))
    }

    /// "1411 E 31st St · 0.4 mi" / "1411 E 31st St · 0.4 millas".
    /// Address parts joined with commas; distance appended when
    /// FindHelpStore returned a distance for this location.
    private var addressLine: String? {
        var parts: [String] = []
        if let l1 = location.addressLine1, !l1.isEmpty { parts.append(l1) }
        var locality = [location.city, location.state]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        if let zip = location.zip, !zip.isEmpty {
            locality = locality.isEmpty ? zip : "\(locality) \(zip)"
        }
        if !locality.isEmpty { parts.append(locality) }
        var line = parts.joined(separator: " · ")
        if let km = location.distanceKm {
            let miles = (km * 0.6213712 * 10).rounded() / 10  // 1 decimal place
            let unit = language == .english ? "mi" : "millas"
            line.append(" · \(miles) \(unit)")
        }
        return line.isEmpty ? nil : line
    }
}

enum FindHelpPeekStrings {
    static let viewDetails = CivicaText(
        "View details",
        es: "Ver detalles"
    )
}
