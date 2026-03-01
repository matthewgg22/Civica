import SwiftUI

struct VoterIDGuideCard: View {
    let stateCode: String?
    let stateName: String?
    @Environment(\.locale) private var locale

    private struct VoterIDMetric {
        let category: String
        let note: String?
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

    private var photoIDRequirementText: String? {
        guard let metric else { return nil }
        if metric.category == "Photo ID required" {
            return localized("app.voter_id.photo_required", fallback: "Photo ID IS required to vote.")
        }
        return localized("app.voter_id.photo_not_required", fallback: "Photo ID IS NOT required to vote.")
    }

    private var resolvedStateName: String {
        if let stateName, !stateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return stateName
        }
        if let code = normalizedStateCode {
            return Self.stateNameByCode[code] ?? code
        }
        return localized("app.voter_id.your_state", fallback: "your state")
    }

    private var headerText: String {
        localized("app.voter_id.requirements.header", fallback: "Voter ID Requirements by State")
    }

    private var missingStatePromptText: String {
        localized("app.voter_id.set_zip_prompt", fallback: "Set your ZIP/state to load your voter ID category.")
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
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(headerText)
                    .font(.headline)
                    .foregroundColor(VoteNowColors.primaryText)

                if let metric, let photoIDRequirementText {
                    Text("\(resolvedStateName): \(photoIDRequirementText)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .padding(.top, 2)

                    if let note = metric.note {
                        Text(note)
                            .font(.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                } else {
                    Text(missingStatePromptText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .padding(.top, 2)
                }
            }

            Spacer(minLength: 8)

            if let asset = StateFlagCatalog.assetName(for: normalizedStateCode) {
                Image(asset)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 40, height: 28)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                    )
                    .padding(.top, 2)
            } else {
                Image(systemName: "location.slash")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .padding(.top, 2)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.06), radius: 3, x: 0, y: 1)
    }

    private static let metricsByStateCode: [String: VoterIDMetric] = [
        "AL": .init(category: "Photo ID required", note: nil),
        "AK": .init(category: "Non-photo ID required", note: nil),
        "AZ": .init(category: "Non-photo ID required", note: nil),
        "AR": .init(category: "Photo ID required", note: nil),
        "CA": .init(category: "No ID required", note: nil),
        "CO": .init(category: "Non-photo ID required", note: nil),
        "CT": .init(category: "Non-photo ID required", note: nil),
        "DE": .init(category: "Non-photo ID required", note: nil),
        "FL": .init(category: "Photo ID required", note: nil),
        "GA": .init(category: "Photo ID required", note: nil),
        "HI": .init(category: "No ID required", note: nil),
        "ID": .init(category: "Photo ID required", note: nil),
        "IL": .init(category: "No ID required", note: nil),
        "IN": .init(category: "Photo ID required", note: nil),
        "IA": .init(category: "Non-photo ID required", note: nil),
        "KS": .init(category: "Photo ID required", note: nil),
        "KY": .init(category: "Photo ID required", note: nil),
        "LA": .init(category: "Photo ID required", note: nil),
        "ME": .init(category: "No ID required", note: nil),
        "MD": .init(category: "No ID required", note: nil),
        "MA": .init(category: "No ID required", note: nil),
        "MI": .init(category: "Photo ID required", note: "Affidavit option available."),
        "MN": .init(category: "No ID required", note: nil),
        "MS": .init(category: "Photo ID required", note: nil),
        "MO": .init(category: "Photo ID required", note: nil),
        "MT": .init(category: "Photo ID required", note: nil),
        "NE": .init(category: "Photo ID required", note: nil),
        "NV": .init(category: "No ID required", note: "Question 7 passed in 2024; second approval needed in 2026."),
        "NH": .init(category: "Photo ID required", note: nil),
        "NJ": .init(category: "No ID required", note: nil),
        "NM": .init(category: "No ID required", note: nil),
        "NY": .init(category: "No ID required", note: nil),
        "NC": .init(category: "Photo ID required", note: nil),
        "ND": .init(category: "Non-photo ID required", note: nil),
        "OH": .init(category: "Photo ID required", note: nil),
        "OK": .init(category: "Non-photo ID required", note: nil),
        "OR": .init(category: "No ID required", note: "Vote-by-mail state."),
        "PA": .init(category: "No ID required", note: nil),
        "RI": .init(category: "Photo ID required", note: nil),
        "SC": .init(category: "Photo ID required", note: nil),
        "SD": .init(category: "Photo ID required", note: nil),
        "TN": .init(category: "Photo ID required", note: nil),
        "TX": .init(category: "Photo ID required", note: nil),
        "UT": .init(category: "Non-photo ID required", note: nil),
        "VT": .init(category: "No ID required", note: nil),
        "VA": .init(category: "Non-photo ID required", note: nil),
        "WA": .init(category: "Non-photo ID required", note: "Vote-by-mail state."),
        "WV": .init(category: "Photo ID required", note: "Law signed May 1, 2025."),
        "WI": .init(category: "Photo ID required", note: nil),
        "WY": .init(category: "Non-photo ID required", note: nil)
    ]

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
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
    ]
}

struct VoterIDGuideCard_Previews: PreviewProvider {
    static var previews: some View {
        VoterIDGuideCard(stateCode: "CA", stateName: "California")
            .padding()
    }
}
