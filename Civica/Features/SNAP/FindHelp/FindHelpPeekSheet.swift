import CivicaDesignSystem
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
            Button(action: onViewDetails) {
                Text(FindHelpPeekStrings.viewDetails.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control)
                            .fill(CivicaColors.brickPrimary)
                    )
            }
            .padding(.top, CivicaSpacing.sm)
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.height(260)])
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

    private var pillColor: Color {
        switch location.primaryServiceType {
        case .snapApplicationHelp: return CivicaColors.brickPrimary
        case .foodAssistance:      return CivicaColors.accentTeal
        case .both:                return CivicaColors.graphite
        }
    }

    private var pillLabel: String {
        switch (location.primaryServiceType, language) {
        case (.snapApplicationHelp, .english): return "SNAP HELP"
        case (.snapApplicationHelp, .spanish): return "AYUDA CON SNAP"
        case (.foodAssistance,      .english): return "FOOD"
        case (.foodAssistance,      .spanish): return "COMIDA"
        case (.both,                .english): return "SNAP + FOOD"
        case (.both,                .spanish): return "SNAP + COMIDA"
        }
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
