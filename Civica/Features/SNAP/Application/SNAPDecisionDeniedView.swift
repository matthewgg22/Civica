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
//
// IA-5 (audit 2026-05-29): all four next-step cards are now real
// NavigationLinks. Appeal is gated on AppealabilityService — if the
// 90-day window has closed (or the denial reason is in the state's
// non-appealable list), Appeal demotes to a static-style card with
// an explainer line, and "Speak with a navigator" promotes to the
// primary CTA in its place.

struct SNAPDecisionDeniedView: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let denialReason: String?
    let onAppeal: () -> Void
    let onStartOver: () -> Void
    let onOpenExternalPortal: () -> Void

    @State private var showReapplyConfirm: Bool = false

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
        .confirmationDialog(
            SNAPStatusHomeStrings.deniedReapplyConfirmTitle.value(in: language),
            isPresented: $showReapplyConfirm,
            titleVisibility: .visible
        ) {
            Button(
                SNAPStatusHomeStrings.deniedReapplyConfirmAction.value(in: language),
                role: .destructive
            ) {
                performReapply()
            }
            Button(
                SNAPStatusHomeStrings.deniedReapplyCancelAction.value(in: language),
                role: .cancel
            ) { }
        } message: {
            Text(SNAPStatusHomeStrings.deniedReapplyConfirmBody.value(in: language))
        }
    }

    // MARK: - Appealability gate

    /// Result of `AppealabilityService.evaluate(...)` for the
    /// current denial. Computed once per render — pure function of
    /// the passed-in reason + store's recorded decision date + the
    /// applicant's state. Default fallback is `withinWindow` /
    /// `isAppealable: true` so the surface degrades to today's
    /// behavior when the decision date isn't recorded.
    private var appealability: AppealabilityResult {
        let stateCode = SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
            ?? "CA"
        let decisionDate = statusStore.timestamp(for: .decisionDenied) ?? Date()
        return AppealabilityService.evaluate(
            reason: denialReason,
            state: stateCode,
            decisionDate: decisionDate
        )
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.deniedTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .accessibilityAddTraits(.isHeader)
                .fixedSize(horizontal: false, vertical: true)

            Text(SNAPStatusHomeStrings.deniedBody(
                stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                language: language
            ))
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

            Text(denialReason ?? SNAPStatusHomeStrings.deniedReasonMissing(
                stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                language: language
            ))
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
                appealNextStepCard
                reviewNextStepCard
                foodHelpNextStepCard
                reapplyNextStepCard
            }
        }
    }

    // MARK: - Per-card builders

    /// Appeal card: NavigationLink to the appeal-letter generator
    /// when appealable; when not, renders as a static card with an
    /// inline explainer line ("the 90-day appeal window has closed"
    /// / "this category isn't appealable"). Keeps the visual rhythm
    /// of the other cards.
    private var appealNextStepCard: some View {
        Group {
            if appealability.isAppealable {
                NavigationLink {
                    SNAPAppealLetterView(language: language, onClose: {})
                } label: {
                    nextStepCard(
                        icon: "scale.3d",
                        title: SNAPStatusHomeStrings.deniedAppealTitle.value(in: language),
                        body: SNAPStatusHomeStrings.deniedAppealBody.value(in: language),
                        accent: CivicaColors.brickAccent,
                        showChevron: true
                    )
                }
                .buttonStyle(.plain)
                .simultaneousGesture(TapGesture().onEnded { onAppeal() })
                .accessibilityLabel(SNAPStatusHomeStrings.deniedAppealTitle.value(in: language))
            } else {
                nextStepCard(
                    icon: "scale.3d",
                    title: SNAPStatusHomeStrings.deniedAppealTitle.value(in: language),
                    body: SNAPStatusHomeStrings.deniedAppealBody.value(in: language),
                    accent: CivicaColors.graphite,
                    showChevron: false,
                    explainer: appealDemotionExplainer
                )
            }
        }
    }

    private var reviewNextStepCard: some View {
        NavigationLink {
            SNAPApplicationPacketReviewView(
                language: language,
                onReapply: {
                    // Reuse the same confirm-then-reset flow as the
                    // standalone Reapply card so behavior matches no
                    // matter how the user gets here.
                    showReapplyConfirm = true
                }
            )
        } label: {
            nextStepCard(
                icon: "doc.text.magnifyingglass",
                title: SNAPStatusHomeStrings.deniedReviewTitle.value(in: language),
                body: SNAPStatusHomeStrings.deniedReviewBody.value(in: language),
                accent: CivicaColors.ink,
                showChevron: true
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(SNAPStatusHomeStrings.deniedReviewTitle.value(in: language))
    }

    private var foodHelpNextStepCard: some View {
        // Food-help: pushes the FindHelp map pre-filtered to
        // food-assistance results. Denial is the most common moment
        // the user needs immediate food, so the affordance graduates
        // from a passive paragraph to a real route.
        NavigationLink {
            FindHelpRootView(
                initialFilter: FindHelpFilterState(
                    serviceType: .foodAssistance,
                    languageCode: nil
                )
            )
        } label: {
            nextStepCard(
                icon: "fork.knife",
                title: SNAPStatusHomeStrings.deniedFoodHelpTitle.value(in: language),
                body: SNAPStatusHomeStrings.deniedFoodHelpBody.value(in: language),
                accent: CivicaColors.amberPrimary,
                showChevron: true
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint(SNAPStatusHomeStrings.findHelpFoodLinkSubtitle.value(in: language))
    }

    private var reapplyNextStepCard: some View {
        Button {
            showReapplyConfirm = true
        } label: {
            nextStepCard(
                icon: "arrow.clockwise",
                title: SNAPStatusHomeStrings.deniedReapplyTitle.value(in: language),
                body: SNAPStatusHomeStrings.deniedReapplyBody.value(in: language),
                accent: CivicaColors.graphite,
                showChevron: true
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(SNAPStatusHomeStrings.deniedReapplyTitle.value(in: language))
    }

    private var appealDemotionExplainer: String? {
        switch appealability.reason {
        case .windowExpired:
            return SNAPStatusHomeStrings.deniedAppealWindowClosed.value(in: language)
        case .categoryExcluded:
            return SNAPStatusHomeStrings.deniedAppealCategoryExcluded.value(in: language)
        case .withinWindow, .unknownReason:
            return nil
        }
    }

    private func nextStepCard(
        icon: String,
        title: String,
        body: String,
        accent: Color,
        showChevron: Bool = false,
        explainer: String? = nil
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
                if let explainer {
                    Text(explainer)
                        .font(CivicaTypography.caption)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, CivicaSpacing.xs)
                }
            }

            if showChevron {
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
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
        .accessibilityLabel({
            if let explainer { return "\(title). \(body). \(explainer)" }
            return "\(title). \(body)"
        }())
    }

    private var actionButtons: some View {
        VStack(spacing: CivicaSpacing.sm) {
            if appealability.isAppealable {
                // Mission 13 / IA-5 happy path: primary action is a
                // NavigationLink to the appeal-letter generator.
                NavigationLink {
                    SNAPAppealLetterView(language: language, onClose: {})
                } label: {
                    Text(SNAPStatusHomeStrings.deniedPrimaryActionAppeal.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(CivicaColors.brickAccent)
                        )
                }
                .simultaneousGesture(TapGesture().onEnded { onAppeal() })
                .accessibilityLabel(SNAPStatusHomeStrings.deniedPrimaryActionAppeal.value(in: language))
                .accessibilityAddTraits(.isButton)
            } else {
                // IA-5: appealability gate engaged. Promote the
                // navigator-portal action to primary in the appeal
                // slot. Appeal is still reachable as a (non-tappable)
                // card with an explainer line above.
                Button(action: onOpenExternalPortal) {
                    Text(SNAPStatusHomeStrings.deniedPrimaryActionNavigator.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.onPrimaryText)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.control)
                                .fill(CivicaColors.pinePrimary)
                        )
                }
                .accessibilityLabel(SNAPStatusHomeStrings.deniedPrimaryActionNavigator.value(in: language))
                .accessibilityAddTraits(.isButton)
            }

            CivicaSecondaryButton(
                title: SNAPStatusHomeStrings.deniedSecondaryActionReapply.value(in: language),
                action: { showReapplyConfirm = true }
            )
        }
        .padding(.top, CivicaSpacing.md)
    }

    // MARK: - Reapply

    private func performReapply() {
        // Clear the saved answers + reset the status store. Caller's
        // `onStartOver` closure handles the navigation pop back to
        // CivicaEntryView (today: statusStore.reset() chain).
        SNAPApplicationDraftStore().clear()
        onStartOver()
    }
}

// MARK: - Test surface
//
// SNAPDecisionDeniedRoutingTests (IA-5) needs stable predicates
// rather than SwiftUI view introspection. Both extension members are
// pure functions and intentional public API of the view module.

extension SNAPDecisionDeniedView {
    /// Which CTA the primary-action slot renders. Decided entirely
    /// by AppealabilityService — `appeal` is the today-default;
    /// `navigator` only when the gate demotes Appeal.
    enum PrimaryAction: String, Equatable {
        case appeal
        case navigator
    }

    /// Stable list of the four next-step cards. CaseIterable powers
    /// the IA-5 regression that asserts none of them ever revert to
    /// non-tappable static cards.
    enum NextStepCardKind: String, CaseIterable, Equatable {
        case appeal
        case review
        case foodHelp
        case reapply
    }

    /// Pure decision function for the primary action — used by
    /// SNAPDecisionDeniedRoutingTests as a stable predicate.
    static func primaryAction(for result: AppealabilityResult) -> PrimaryAction {
        result.isAppealable ? .appeal : .navigator
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
                onStartOver: {},
                onOpenExternalPortal: {}
            )
        }
    }
}
#endif
