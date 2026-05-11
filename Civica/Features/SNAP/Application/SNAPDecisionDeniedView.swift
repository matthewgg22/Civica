import CivicaDesignSystem
import SwiftUI

// HANDOFF board 23 — denial branch.
//
// When the state agency returns a denial, the user lands here instead
// of the eligibility/benefit-math view. The design canvas is explicit
// about how this surface should feel:
//
//   • Honest, not optimistic. The decision is the decision.
//   • Never blame the user for the system's outcome.
//   • Surface concrete next steps in order of leverage — appeal
//     first (90-day fair-hearing right is federal, 7 CFR 273.15),
//     review next, immediate food help third, reapply last.
//   • No fabricated motion. If we don't have the state's reason yet,
//     say so plainly and point to where the user can find it.
//
// Wiring: CivicaRootView routes to this view when status is
// .decisionDenied. The store carries the milestone timestamp; the
// denial reason (when we have it) is passed in by the caller — for
// v1 that's always nil until inbound notice ingestion ships.

struct SNAPDecisionDeniedView: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let denialReason: String?
    let onAppeal: () -> Void
    let onStartOver: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                reasonSection
                nextStepsSection
                actionButtons
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.deniedTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)

            Text(SNAPStatusHomeStrings.deniedBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var reasonSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.deniedReasonHeading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            Text(denialReason ?? SNAPStatusHomeStrings.deniedReasonMissing.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(CivicaSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    private var nextStepsSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPStatusHomeStrings.deniedNextStepsHeading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            VStack(spacing: CivicaSpacing.md) {
                nextStepCard(
                    icon: "scale.3d",
                    title: SNAPStatusHomeStrings.deniedAppealTitle.value(in: language),
                    body: SNAPStatusHomeStrings.deniedAppealBody.value(in: language),
                    accent: CivicaColors.brickPrimary
                )
                nextStepCard(
                    icon: "doc.text.magnifyingglass",
                    title: SNAPStatusHomeStrings.deniedReviewTitle.value(in: language),
                    body: SNAPStatusHomeStrings.deniedReviewBody.value(in: language),
                    accent: CivicaColors.ink
                )
                nextStepCard(
                    icon: "fork.knife",
                    title: SNAPStatusHomeStrings.deniedFoodHelpTitle.value(in: language),
                    body: SNAPStatusHomeStrings.deniedFoodHelpBody.value(in: language),
                    accent: CivicaColors.accentTeal
                )
                nextStepCard(
                    icon: "arrow.clockwise",
                    title: SNAPStatusHomeStrings.deniedReapplyTitle.value(in: language),
                    body: SNAPStatusHomeStrings.deniedReapplyBody.value(in: language),
                    accent: CivicaColors.graphite
                )
            }
        }
    }

    private func nextStepCard(
        icon: String,
        title: String,
        body: String,
        accent: Color
    ) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 28, alignment: .leading)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(body)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(body)")
    }

    private var actionButtons: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(
                SNAPStatusHomeStrings.deniedPrimaryActionAppeal.value(in: language),
                action: onAppeal
            )
            CivicaSecondaryButton(
                title: SNAPStatusHomeStrings.deniedSecondaryActionReapply.value(in: language),
                action: onStartOver
            )
        }
        .padding(.top, CivicaSpacing.md)
    }
}

#if DEBUG
struct SNAPDecisionDeniedView_Previews: PreviewProvider {
    static var previews: some View {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .decisionDenied)
        return NavigationStack {
            SNAPDecisionDeniedView(
                statusStore: store,
                language: .english,
                denialReason: nil,
                onAppeal: {},
                onStartOver: {}
            )
        }
    }
}
#endif
