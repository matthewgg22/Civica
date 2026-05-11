import CivicaDesignSystem
import SwiftUI

struct FindHelpLocationDetailSheet: View {
    let location: FindHelpLocation
    let sources: [FindHelpSourceAttribution]
    @Environment(\.dismiss) private var dismiss

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    eyebrow
                    headerBlock
                    chipStrip
                    actionRow
                    if let address = formattedAddress() {
                        infoBlock(title: "Address", body: address)
                    }
                    if let phone = location.phone, !phone.isEmpty {
                        infoBlock(title: "Phone", body: phone)
                    }
                    if let hours = formattedHours() {
                        infoBlock(title: "Hours", body: hours)
                    }
                    if let langs = formattedLanguages() {
                        infoBlock(title: "Languages served", body: langs)
                    }
                    if let notes = location.notes, !notes.isEmpty {
                        infoBlock(title: "Notes", body: notes)
                    }
                    Divider().background(CivicaColors.hairline)
                    callAheadDisclaimer
                    sourceAttribution
                    reportIncorrectLink
                }
                .padding(CivicaSpacing.lg)
            }
            .background(CivicaColors.surfaceSecondary)
            .navigationTitle(location.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    /// HANDOFF map · C — "Place details" eyebrow above the title.
    /// Mono uppercase per board 33; sets the user's frame before the
    /// dense block of place data below.
    private var eyebrow: some View {
        Text(FindHelpStrings.detailEyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
    }

    /// HANDOFF map · C — "Report incorrect info" footer link. Quiet
    /// graphite text-link, centered. Real wiring (mailto: or a
    /// feedback endpoint) lands in a follow-up commit; for v1 the
    /// affordance exists so users have a visible path when hours
    /// or addresses have drifted from the source-of-truth.
    private var reportIncorrectLink: some View {
        Button(action: {
            // Hand-off lives in a later commit — mailto: composer or
            // a feedback endpoint inside the FindHelp service.
        }) {
            Text(FindHelpStrings.detailReportIncorrect.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .underline()
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, CivicaSpacing.md)
    }

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                categoryBadge
                Text(serviceTypeLabel(for: location))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
            }
            Text(location.name)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    /// Retailer-aware category badge. Help-directory rows reuse the
    /// existing ServiceTypeBadge; retailer rows render a small circle
    /// with the SF Symbol glyph + category color from the pin renderer
    /// so the detail sheet's badge matches the map pin the user
    /// just tapped.
    @ViewBuilder
    private var categoryBadge: some View {
        if location.resolvedRecordKind == .ebtRetailer {
            Image(systemName: FindHelpAnnotationView.glyphSymbolName(for: location))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(width: 28, height: 28)
                .background(
                    Circle().fill(
                        Color(uiColor: FindHelpAnnotationView.pinColor(for: location))
                    )
                )
        } else {
            ServiceTypeBadge(serviceType: location.primaryServiceType)
        }
    }

    /// Eligibility chips for retailer rows only — names the payment
    /// methods accepted here. EBT is implicit for any .ebtRetailer
    /// row; WIC and HIP chips show only when the row carries those
    /// flags from the data source (live RPC or seed fixture).
    @ViewBuilder
    private var chipStrip: some View {
        if location.resolvedRecordKind == .ebtRetailer {
            HStack(spacing: CivicaSpacing.xs) {
                chip(FindHelpStrings.chipEbt.value(in: language), background: CivicaColors.accentTeal)
                if location.acceptsWic == true {
                    chip(FindHelpStrings.chipWic.value(in: language), background: CivicaColors.indigoStatus)
                }
                if location.acceptsHip == true {
                    chip(FindHelpStrings.chipHip.value(in: language), background: CivicaColors.warningAmber)
                }
                Spacer(minLength: 0)
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

    private var actionRow: some View {
        HStack(spacing: CivicaSpacing.md) {
            if location.hasCoordinates,
               let lat = location.latitude,
               let lng = location.longitude {
                Button {
                    openAppleMaps(lat: lat, lng: lng, name: location.name)
                } label: {
                    Label {
                        Text("find_help.detail.get_directions")
                    } icon: {
                        Image(systemName: "arrow.triangle.turn.up.right.circle.fill")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }

            if let phone = location.phone, let url = telURL(from: phone) {
                Button {
                    UIApplication.shared.open(url)
                } label: {
                    Label {
                        Text("find_help.detail.call")
                    } icon: {
                        Image(systemName: "phone.fill")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private func infoBlock(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(title)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
            Text(body)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var callAheadDisclaimer: some View {
        Text("find_help.disclaimer.call_ahead")
            .font(CivicaTypography.footnoteStrong)
            .foregroundStyle(CivicaColors.graphite)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sourceAttribution: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text("find_help.detail.source_label")
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
            Text(sourceDisplayName)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.ink)
            if let lastUpdated = formattedSourceTimestamp() {
                Text("Last updated: \(lastUpdated)")
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sourceDisplayName: String {
        if let attr = sources.first(where: { $0.source == location.source.rawValue }) {
            return attr.displayName
        }
        switch location.source {
        case .usda: return "USDA SNAP State Directory of Resources"
        case .stateMaDta: return "Massachusetts Department of Transitional Assistance"
        case .maPantries: return "Massachusetts Food Pantry Directory (curated public data)"
        case .feedingAmerica: return "Feeding America Food Bank Network"
        case .twoOneOne: return "211 Food Assistance Resources"
        case .usdaRetailer: return "USDA SNAP Retailer Locator"
        }
    }

    private func formattedSourceTimestamp() -> String? {
        guard let date = location.sourceLastUpdatedAt ?? location.civicaLastSyncedAt else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func formattedAddress() -> String? {
        var parts: [String] = []
        if let line1 = location.addressLine1, !line1.isEmpty { parts.append(line1) }
        if let line2 = location.addressLine2, !line2.isEmpty { parts.append(line2) }
        var locality = [location.city, location.state].compactMap { $0 }.joined(separator: ", ")
        if let zip = location.zip, !zip.isEmpty {
            locality = locality.isEmpty ? zip : "\(locality) \(zip)"
        }
        if !locality.isEmpty { parts.append(locality) }
        return parts.isEmpty ? nil : parts.joined(separator: "\n")
    }

    private func formattedHours() -> String? {
        guard let hours = location.hoursJson, !hours.isEmpty else { return nil }
        let days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        let lines = days.compactMap { key -> String? in
            guard let value = hours[key] else { return nil }
            return "\(key.capitalized): \(value)"
        }
        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }

    private func formattedLanguages() -> String? {
        guard let langs = location.languagesJson, !langs.isEmpty else { return nil }
        return langs.map { localizedLanguageName(for: $0) }.joined(separator: ", ")
    }

    private func localizedLanguageName(for code: String) -> String {
        Locale.current.localizedString(forLanguageCode: code) ?? code
    }

    private func serviceTypeLabel(for location: FindHelpLocation) -> String {
        switch location.resolvedRecordKind {
        case .helpDirectory:
            switch location.primaryServiceType {
            case .snapApplicationHelp: return "SNAP application help"
            case .foodAssistance: return "Food assistance"
            case .both: return "SNAP help + food"
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket: return "Grocery"
            case .smallGrocer: return "Local grocer"
            case .farmersMarket: return "Farmers market"
            case .coOp: return "Co-op"
            case .restaurantRMP: return "Restaurant meals (RMP)"
            }
        }
    }

    private func telURL(from phone: String) -> URL? {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        guard !digits.isEmpty else { return nil }
        return URL(string: "tel:\(digits)")
    }

    private func openAppleMaps(lat: Double, lng: Double, name: String) {
        var components = URLComponents(string: "http://maps.apple.com/")!
        components.queryItems = [
            URLQueryItem(name: "daddr", value: "\(lat),\(lng)"),
            URLQueryItem(name: "q", value: name)
        ]
        if let url = components.url {
            UIApplication.shared.open(url)
        }
    }
}
