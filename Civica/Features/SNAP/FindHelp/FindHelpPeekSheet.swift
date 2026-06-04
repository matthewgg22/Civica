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
                        directionsLabel,
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
                    Text(moreInfoLabel)
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

    private var directionsLabel: String {
        switch language {
        case .spanish: return "Cómo llegar"
        case .mandarin: return "获取路线"
        case .vietnamese: return "Xem chỉ đường"
        case .tagalog: return "Kunin ang direksyon"
        default: return "Get directions"
        }
    }

    private var moreInfoLabel: String {
        switch language {
        case .spanish: return "Más info"
        case .mandarin: return "更多信息"
        case .vietnamese: return "Thêm thông tin"
        case .tagalog: return "Higit pang detalye"
        default: return "More info"
        }
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
            case (.snapApplicationHelp, .english): return "SNAP HELP"
            case (.snapApplicationHelp, .mandarin): return "SNAP 帮助"
            case (.snapApplicationHelp, .spanish): return "AYUDA CON SNAP"
            case (.snapApplicationHelp, .vietnamese): return "HỖ TRỢ SNAP"
            case (.snapApplicationHelp, .tagalog): return "TULONG SA SNAP"
            case (.foodAssistance, .english): return "FOOD"
            case (.foodAssistance, .mandarin): return "食物"
            case (.foodAssistance,      .spanish): return "COMIDA"
            case (.foodAssistance, .vietnamese): return "THỰC PHẨM"
            case (.foodAssistance, .tagalog): return "PAGKAIN"
            case (.both, .english): return "SNAP + FOOD"
            case (.both, .mandarin): return "SNAP + 食物"
            case (.both,                .spanish): return "SNAP + COMIDA"
            case (.both, .vietnamese): return "SNAP + THỰC PHẨM"
            case (.both, .tagalog): return "SNAP + PAGKAIN"
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
            let unit: String
            switch language {
            case .spanish: unit = "millas"
            case .vietnamese: unit = "dặm"
            default: unit = "mi"
            }
            line.append(" · \(miles) \(unit)")
        }
        return line.isEmpty ? nil : line
    }
}

enum FindHelpPeekStrings {
    static let viewDetails = CivicaText(
        "View details",
        es: "Ver detalles",
        zh: "查看详情",
        vi: "Xem chi tiết",
        tl: "Tingnan ang detalye"
    )
}
