import CivicaDesignSystem
import SwiftUI

struct FindHelpListView: View {
    let locations: [FindHelpLocation]
    let onSelect: (FindHelpLocation) -> Void

    var body: some View {
        List(locations) { location in
            Button {
                onSelect(location)
            } label: {
                FindHelpListRow(location: location)
            }
            .buttonStyle(.plain)
            .listRowBackground(CivicaColors.brandSoftBlue)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(CivicaColors.brandSoftBlue)
    }
}

private struct FindHelpListRow: View {
    let location: FindHelpLocation

    var body: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            ServiceTypeBadge(serviceType: location.primaryServiceType)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(location.name)
                    .font(CivicaTypography.subheadBold)
                    .foregroundStyle(CivicaColors.textPrimary)
                    .lineLimit(2)

                if let addressLine = formattedAddress() {
                    Text(addressLine)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.textSecondary)
                        .lineLimit(2)
                }

                HStack(spacing: CivicaSpacing.sm) {
                    if let km = location.distanceKm {
                        Text(formatDistance(km: km))
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.textSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundStyle(CivicaColors.textSecondary)
                }
            }
        }
        .padding(.vertical, CivicaSpacing.sm)
        .padding(.horizontal, CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }

    private func formattedAddress() -> String? {
        var parts: [String] = []
        if let line1 = location.addressLine1, !line1.isEmpty { parts.append(line1) }
        var locality = [location.city, location.state].compactMap { $0 }.joined(separator: ", ")
        if let zip = location.zip, !zip.isEmpty {
            locality = locality.isEmpty ? zip : "\(locality) \(zip)"
        }
        if !locality.isEmpty { parts.append(locality) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func formatDistance(km: Double) -> String {
        let miles = km * 0.621_371
        return String(format: "%.1f mi away", miles)
    }
}

struct ServiceTypeBadge: View {
    let serviceType: FindHelpServiceType

    var body: some View {
        Image(systemName: iconName)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(CivicaColors.onPrimaryText)
            .frame(width: 28, height: 28)
            .background(Circle().fill(backgroundColor))
    }

    private var iconName: String {
        switch serviceType {
        case .snapApplicationHelp: return "doc.text.fill"
        case .foodAssistance: return "fork.knife"
        case .both: return "square.stack.fill"
        }
    }

    var backgroundColor: Color {
        switch serviceType {
        case .snapApplicationHelp: return CivicaColors.ctaBlue
        case .foodAssistance: return CivicaColors.warningAmber
        case .both: return CivicaColors.indigoStatus
        }
    }
}
