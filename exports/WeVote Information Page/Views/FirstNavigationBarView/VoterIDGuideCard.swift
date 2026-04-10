import SwiftUI

struct VoterIDGuideCard: View {
    let stateCode: String?
    let stateName: String?
    @Environment(\.locale) private var locale

    private struct VoterIDMetric: Decodable {
        let jurisdiction: String
        let type: String
        let ruleCategory: String
        let status: String
        let acceptedOptions: String
        let alternativeIfNoDocument: String
        let keyCaveat: String
        let sourceURLs: String
    }

    private enum RequirementClassification {
        case photoRequired
        case nonPhotoAccepted
        case noDocument
        case conditional
    }

    private var normalizedStateCode: String? {
        guard let stateCode else { return nil }
        let cleaned = stateCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return cleaned.isEmpty ? nil : cleaned
    }

    private var metric: VoterIDMetric? {
        guard let code = normalizedStateCode else { return nil }
        return Self.metricsByStateCode[code]
    }

    private var resolvedStateName: String {
        if let stateName, !stateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return stateName
        }
        if let metric {
            return metric.jurisdiction
        }
        if let code = normalizedStateCode {
            return Self.stateNameByCode[code] ?? code
        }
        return localized("app.voter_id.your_state", fallback: "your state")
    }

    private var headerText: String {
        localized("app.voter_id.requirements.header.short", fallback: "Voter ID Requirements")
    }

    private var stateHeaderText: String {
        let format = localized("app.voter_id.requirements.state_line", fallback: "State: %@")
        return String(format: format, locale: locale, resolvedStateName)
    }

    private var requirementSummaryText: String? {
        guard let metric else { return nil }
        switch requirementClassification(for: metric) {
        case .photoRequired:
            return localized("app.voter_id.requirement.photo", fallback: "Photo ID is required for in-person voting in this state.")
        case .nonPhotoAccepted:
            return localized("app.voter_id.requirement.non_photo", fallback: "ID is required, and non-photo documents may be accepted.")
        case .noDocument:
            return localized(
                "app.voter_id.requirement.no_document",
                fallback: "No ID document is ordinarily required for in-person voting in this jurisdiction."
            )
        case .conditional:
            return localized(
                "app.voter_id.requirement.conditional",
                fallback: "ID requirements can be conditional in this jurisdiction. Review accepted options and caveats below."
            )
        }
    }

    private var categoryLabelText: String {
        guard let metric else { return localized("app.voter_id.requirement.unknown", fallback: "Rule varies") }
        switch requirementClassification(for: metric) {
        case .photoRequired:
            return localized("app.voter_id.category.photo", fallback: "Photo ID required")
        case .nonPhotoAccepted:
            return localized("app.voter_id.category.non_photo", fallback: "Non-photo options accepted")
        case .noDocument:
            return localized("app.voter_id.category.none", fallback: "No document usually required")
        case .conditional:
            return localized("app.voter_id.category.conditional", fallback: "Conditional or limited rule")
        }
    }

    private func acceptedOptionsHeadingText(for metric: VoterIDMetric) -> String? {
        switch requirementClassification(for: metric) {
        case .noDocument:
            return nil
        default:
            return localized(
                "app.voter_id.accepted_options.heading.documents",
                fallback: "Accepted non-photo/documentary options"
            )
        }
    }

    private func acceptedOptionsText(for metric: VoterIDMetric) -> String? {
        if requirementClassification(for: metric) == .noDocument {
            return nil
        }

        let raw = metric.acceptedOptions.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }

        let segments = raw
            .split(separator: ";")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard segments.count > 1 else { return raw }
        return segments.map { "• \($0)" }.joined(separator: "\n")
    }

    private func supplementalNoteText(for metric: VoterIDMetric) -> String? {
        let classification = requirementClassification(for: metric)
        var lines: [String] = []

        let alternative = metric.alternativeIfNoDocument.trimmingCharacters(in: .whitespacesAndNewlines)
        if !alternative.isEmpty {
            lines.append("Process: \(conciseDetailLine(alternative))")
        }

        let caveat = metric.keyCaveat.trimmingCharacters(in: .whitespacesAndNewlines)
        if classification == .conditional,
           !caveat.isEmpty,
           !isClearlyRedundant(caveat, comparedTo: alternative) {
            lines.append("Note: \(conciseDetailLine(caveat))")
        }

        guard !lines.isEmpty else { return nil }
        return lines.joined(separator: "\n\n")
    }

    private func conciseDetailLine(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        if let range = trimmed.range(of: ". ") {
            return String(trimmed[..<range.lowerBound]) + "."
        }

        if trimmed.count > 180 {
            return String(trimmed.prefix(177)).trimmingCharacters(in: .whitespacesAndNewlines) + "..."
        }
        return trimmed
    }

    private func isClearlyRedundant(_ first: String, comparedTo second: String) -> Bool {
        let lhs = first.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let rhs = second.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !lhs.isEmpty, !rhs.isEmpty else { return false }
        return lhs == rhs || lhs.contains(rhs) || rhs.contains(lhs)
    }

    private func requirementClassification(for metric: VoterIDMetric) -> RequirementClassification {
        let rule = metric.ruleCategory.lowercased()
        let status = metric.status.lowercased()

        if status == "no document" || rule.contains("no-documentary") || rule.contains("signature/photo at vote center") {
            return .noDocument
        }

        if status == "conditional" || status == "not identified" || status == "limited" {
            return .conditional
        }

        if rule.contains("non-photo") || status == "yes" {
            return .nonPhotoAccepted
        }

        if rule.contains("photo") || status == "no" {
            return .photoRequired
        }

        return .conditional
    }

    private func shouldShowRequirementSummary(for metric: VoterIDMetric) -> Bool {
        // Badge already states "Photo ID required", so avoid repeating the same sentence.
        requirementClassification(for: metric) != .photoRequired
    }

    private var categoryAccentColor: Color {
        guard let metric else { return VoteNowColors.primaryCTA }
        switch requirementClassification(for: metric) {
        case .photoRequired:
            return VoteNowColors.richRed
        case .nonPhotoAccepted:
            return VoteNowColors.warningAmber
        case .noDocument:
            return VoteNowColors.successGreen
        case .conditional:
            return VoteNowColors.primaryCTA
        }
    }

    private var categoryIconName: String {
        guard let metric else { return "person.crop.rectangle" }
        switch requirementClassification(for: metric) {
        case .photoRequired:
            return "camera.fill"
        case .nonPhotoAccepted:
            return "person.text.rectangle.fill"
        case .noDocument:
            return "checkmark.seal.fill"
        case .conditional:
            return "exclamationmark.triangle.fill"
        }
    }

    private var missingStatePromptText: String {
        localized("app.voter_id.set_zip_prompt", fallback: "Set your ZIP/state to load your voter ID category.")
    }

    private var stateFlagSize: CGSize {
        CGSize(width: 56, height: 38)
    }

    private func localized(_ key: String, fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "person.text.rectangle.fill")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .frame(width: 30, height: 30)
                        .background(VoteNowColors.primaryCTA.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(headerText)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.mutedText)
                        Text(stateHeaderText)
                            .font(.headline.weight(.bold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer(minLength: 8)

                stateFlagBadge
            }

            if let metric, let requirementSummaryText {
                HStack(spacing: 8) {
                    Image(systemName: categoryIconName)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(categoryAccentColor)
                    Text(categoryLabelText)
                        .font(.caption.weight(.bold))
                        .foregroundColor(categoryAccentColor)
                        .lineLimit(1)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(categoryAccentColor.opacity(0.12))
                .overlay(
                    Capsule()
                        .stroke(categoryAccentColor.opacity(0.34), lineWidth: 1)
                )
                .clipShape(Capsule())

                if shouldShowRequirementSummary(for: metric) {
                    Text(requirementSummaryText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let options = acceptedOptionsText(for: metric) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let heading = acceptedOptionsHeadingText(for: metric) {
                            Text(heading)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
                        }
                        Text(options)
                            .font(.caption)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(VoteNowColors.infoSurfaceBlue.opacity(0.35))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }

                if let note = supplementalNoteText(for: metric) {
                    Text(note)
                        .font(.caption)
                        .foregroundColor(VoteNowColors.mutedText)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(VoteNowColors.appBackground.opacity(0.88))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            } else {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "location.slash")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                    Text(missingStatePromptText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(10)
                .background(VoteNowColors.infoSurfaceBlue.opacity(0.48))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            VoteNowColors.surfaceWhite,
                            VoteNowColors.brandSoftBlue.opacity(0.09)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.16), lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.07), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private var stateFlagBadge: some View {
        if let asset = StateFlagCatalog.assetName(for: normalizedStateCode) {
            Image(asset)
                .resizable()
                .scaledToFill()
                .frame(width: stateFlagSize.width, height: stateFlagSize.height)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(VoteNowColors.surfaceWhite)
                )
                .opensMyInfoPanelOnLongPress()
        } else {
            Image(systemName: "location.slash")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
                .frame(width: 28, height: 28)
                .background(VoteNowColors.primaryCTA.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }

    private static let metricsByStateCode: [String: VoterIDMetric] = {
        guard let url = Bundle.main.url(forResource: "USVoterIDNonPhotoByJurisdiction", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: VoterIDMetric].self, from: data) else {
            return [:]
        }
        return decoded
    }()

    private static let stateNameByCode: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
        "DC": "District of Columbia", "AS": "American Samoa", "GU": "Guam",
        "MP": "Northern Mariana Islands", "PR": "Puerto Rico", "VI": "U.S. Virgin Islands"
    ]
}

struct VoterIDGuideCard_Previews: PreviewProvider {
    static var previews: some View {
        VoterIDGuideCard(stateCode: "CA", stateName: "California")
            .padding()
    }
}
