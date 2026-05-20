import CivicaDesignSystem
import SwiftUI

/// Pre-submission QC error risk badge for a navigator reviewing a packet.
///
/// Calls POST /me/packets/:packetId/error-risk on appear and renders a
/// green / amber / red tier card. Hides itself on network failure so it
/// never blocks the primary navigator workflow.
struct SNAPErrorRiskBadge: View {
    let packetId: String
    let apiClient: (any EnrollmentAPIClient)?

    @State private var result: ErrorRiskResult?
    @State private var isLoading = false

    var body: some View {
        Group {
            if isLoading {
                HStack(spacing: CivicaSpacing.sm) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Checking submission quality…")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
                .padding(CivicaSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .stroke(CivicaColors.hairline, lineWidth: 1)
                        )
                )
            } else if let result, result.tier != .incomplete {
                riskCard(result)
            }
        }
        .task {
            await load()
        }
    }

    private func riskCard(_ result: ErrorRiskResult) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(spacing: CivicaSpacing.sm) {
                Circle()
                    .fill(dotColor(result.tier))
                    .frame(width: 10, height: 10)
                Text(tierLabel(result.tier))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
                if let score = result.score {
                    Text("Score \(score)")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
            }

            Text(tierDescription(result.tier))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)

            if !result.factors.isEmpty {
                VStack(alignment: .leading, spacing: CivicaSpacing.xxs) {
                    ForEach(result.factors, id: \.self) { factor in
                        HStack(spacing: CivicaSpacing.xs) {
                            Image(systemName: "exclamationmark.circle")
                                .font(.caption)
                                .foregroundStyle(factorColor(result.tier))
                            Text(factorLabel(factor))
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.ink)
                        }
                    }
                }
                .padding(.top, CivicaSpacing.xxs)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .fill(cardBackground(result.tier))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .stroke(cardBorder(result.tier), lineWidth: 1)
                )
        )
    }

    private func load() async {
        guard let client = apiClient, !packetId.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        result = try? await client.fetchErrorRisk(packetId: packetId)
    }

    // MARK: - Helpers

    private func dotColor(_ tier: ErrorRiskTier) -> Color {
        switch tier {
        case .high:       return CivicaColors.pinePrimary
        case .medium:     return CivicaColors.warningAmber
        case .low:        return CivicaColors.teal
        case .incomplete: return CivicaColors.graphite
        }
    }

    private func factorColor(_ tier: ErrorRiskTier) -> Color {
        switch tier {
        case .high:   return CivicaColors.pinePrimary
        case .medium: return CivicaColors.warningAmber
        default:      return CivicaColors.graphite
        }
    }

    private func cardBackground(_ tier: ErrorRiskTier) -> Color {
        switch tier {
        case .high:       return CivicaColors.pinePrimary.opacity(0.06)
        case .medium:     return CivicaColors.warningAmber.opacity(0.06)
        case .low:        return CivicaColors.tealSurface
        case .incomplete: return CivicaColors.surfacePrimary
        }
    }

    private func cardBorder(_ tier: ErrorRiskTier) -> Color {
        switch tier {
        case .high:       return CivicaColors.pinePrimary.opacity(0.25)
        case .medium:     return CivicaColors.warningAmber.opacity(0.25)
        case .low:        return CivicaColors.teal.opacity(0.25)
        case .incomplete: return CivicaColors.hairline
        }
    }

    private func tierLabel(_ tier: ErrorRiskTier) -> String {
        switch tier {
        case .high:       return "High error risk"
        case .medium:     return "Medium error risk"
        case .low:        return "Low error risk"
        case .incomplete: return "Risk not calculated"
        }
    }

    private func tierDescription(_ tier: ErrorRiskTier) -> String {
        switch tier {
        case .high:
            return "This packet has unverified income or housing information that commonly leads to QC errors."
        case .medium:
            return "Some income or housing details are unverified. Review flagged items before submitting."
        case .low:
            return "Key income and housing details are verified. No significant risk factors detected."
        case .incomplete:
            return "Not enough answers to calculate a risk score."
        }
    }

    private func factorLabel(_ factor: String) -> String {
        switch factor {
        case "earned_income_unverified":     return "Earned income not verified via Argyle"
        case "shelter_utility_unverified":   return "Shelter or utility costs unverified"
        case "shared_lease_unverified":      return "Shared-lease arrangement unverified"
        case "assets_unverified":            return "Asset amounts unverified"
        case "benefit_impact_unverified":    return "Benefit impact calculation unverified"
        default:                             return factor.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}
