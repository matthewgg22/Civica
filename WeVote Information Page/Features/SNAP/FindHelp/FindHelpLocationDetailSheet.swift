import CivicaDesignSystem
import SwiftUI

struct FindHelpLocationDetailSheet: View {
    let location: FindHelpLocation
    let sources: [FindHelpSourceAttribution]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    headerBlock
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

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                ServiceTypeBadge(serviceType: location.primaryServiceType)
                Text(serviceTypeLabel(location.primaryServiceType))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
            }
            Text(location.name)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
        }
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

    private func serviceTypeLabel(_ type: FindHelpServiceType) -> String {
        switch type {
        case .snapApplicationHelp: return "SNAP application help"
        case .foodAssistance: return "Food assistance"
        case .both: return "Both"
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
