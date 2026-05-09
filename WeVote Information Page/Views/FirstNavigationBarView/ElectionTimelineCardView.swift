import SwiftUI

struct ElectionTimelineCardView: View {
    @Environment(\.locale) private var locale
    let stateLabel: String
    let titleText: String
    let subtitleText: String?
    let electionDateText: String
    let badgeText: String?
    let showPlanButton: Bool
    let canMakePlan: Bool
    let onPlan: () -> Void
    let onFlag: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                Text(stateLabel)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 8)

                Button(action: onFlag) {
                    Image(systemName: "flag")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(CivicaColors.ctaBlue)
                        .frame(width: 36, height: 36)
                        .background(
                            Circle()
                                .fill(CivicaColors.infoSurfaceBlue)
                        )
                }
                .buttonStyle(.plain)
                .contentShape(Circle())
                .accessibilityLabel(l("app.timeline.flag.accessibility", "Flag election"))
            }

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(titleText)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundColor(CivicaColors.textPrimary)
                    .lineLimit(2)

                if let subtitleText, !subtitleText.isEmpty {
                    Text(subtitleText)
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.textSecondary)
                        .lineLimit(2)
                }
            }

            HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                Text(electionDateText)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.textPrimary)

                Spacer(minLength: 8)

                if let badgeText, !badgeText.isEmpty {
                    Text(badgeText)
                        .font(CivicaTypography.captionStrong)
                        .foregroundColor(CivicaColors.ctaBlue)
                        .padding(.horizontal, CivicaSpacing.sm)
                        .padding(.vertical, CivicaSpacing.xs)
                        .background(CivicaColors.infoSurfaceBlue)
                        .clipShape(Capsule())
                }
            }

            if showPlanButton {
                Button(action: onPlan) {
                    Text(canMakePlan
                         ? l("app.timeline.mapv.button.make_plan", "Make a Plan to Vote")
                         : l("app.timeline.mapv.button.passed", "Election Day Passed"))
                        .font(CivicaTypography.subheadStrong)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, CivicaSpacing.sm)
                }
                .buttonStyle(.plain)
                .disabled(!canMakePlan)
                .foregroundColor(canMakePlan ? .white : CivicaColors.textPrimary.opacity(0.75))
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                        .fill(canMakePlan ? CivicaColors.ctaBlue : CivicaColors.infoSurfaceBlue)
                )
            }
        }
        .padding(CivicaSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.xl, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.xl, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
        .civicaShadow(.hairline, opacity: 0.06)
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }
}
