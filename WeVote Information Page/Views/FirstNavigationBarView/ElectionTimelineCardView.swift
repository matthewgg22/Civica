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
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                Text(stateLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 8)

                Button(action: onFlag) {
                    Image(systemName: "flag")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(VoteNowColors.ctaBlue)
                        .frame(width: 36, height: 36)
                        .background(
                            Circle()
                                .fill(VoteNowColors.infoSurfaceBlue)
                        )
                }
                .buttonStyle(.plain)
                .contentShape(Circle())
                .accessibilityLabel(l("app.timeline.flag.accessibility", "Flag election"))
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(titleText)
                    .font(.headline)
                    .foregroundColor(VoteNowColors.textPrimary)
                    .lineLimit(2)

                if let subtitleText, !subtitleText.isEmpty {
                    Text(subtitleText)
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.textSecondary)
                        .lineLimit(2)
                }
            }

            HStack(alignment: .center, spacing: 8) {
                Text(electionDateText)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.textPrimary)

                Spacer(minLength: 8)

                if let badgeText, !badgeText.isEmpty {
                    Text(badgeText)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.ctaBlue)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(VoteNowColors.infoSurfaceBlue)
                        .clipShape(Capsule())
                }
            }

            if showPlanButton {
                Button(action: onPlan) {
                    Text(canMakePlan
                         ? l("app.timeline.mapv.button.make_plan", "Make a Plan to Vote")
                         : l("app.timeline.mapv.button.passed", "Election Day Passed"))
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .disabled(!canMakePlan)
                .foregroundColor(canMakePlan ? .white : VoteNowColors.textPrimary.opacity(0.75))
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(canMakePlan ? VoteNowColors.ctaBlue : VoteNowColors.infoSurfaceBlue)
                )
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(VoteNowColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
        )
        .shadow(color: VoteNowColors.textPrimary.opacity(0.06), radius: 3, x: 0, y: 1)
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
