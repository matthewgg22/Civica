import CivicaDesignSystem
import SwiftUI

// Self-contained SNAP benefit estimator. Routes from anywhere — no
// router dependency, no env objects, no analytics, no network. Five
// inputs, live recalculation, Apply CTA. Optional sheet expansion
// reuses SNAPDecisionMathView for the full deduction breakdown so
// the trust artifact ("expose every step of the math") is one tap
// away on eligible outcomes without bloating the top-of-funnel UI.

struct SNAPBenefitEstimatorView: View {

    struct InitialState: Equatable {
        var householdSize: Int = 2
        var elderlyOrDisabled: Bool = false
        var grossMonthlyIncome: Decimal = 1_800
        var monthlyRent: Decimal = 1_400
        var paysUtilitiesSeparately: Bool = true
    }

    let onApply: () -> Void
    let onClose: (() -> Void)?
    // IS-4 / UD-3 (audit 2026-05-29): soft-ineligibility surfaces three
    // explicit next steps. The flow view (SNAPEstimatorFlowView) owns
    // navigation; the pure view just calls the closures. Optional so
    // legacy call sites and previews keep compiling without forcing
    // every caller to wire navigation it doesn't need.
    let onFindHelp: (() -> Void)?
    let onOpenStatePortal: (() -> Void)?

    @State private var inputs: SNAPBenefitEstimatorInputs
    @State private var showsMath: Bool = false
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    init(
        onApply: @escaping () -> Void,
        onClose: (() -> Void)? = nil,
        onFindHelp: (() -> Void)? = nil,
        onOpenStatePortal: (() -> Void)? = nil,
        initialState: InitialState? = nil
    ) {
        self.onApply = onApply
        self.onClose = onClose
        self.onFindHelp = onFindHelp
        self.onOpenStatePortal = onOpenStatePortal
        let seed = initialState ?? InitialState()
        self._inputs = State(initialValue: SNAPBenefitEstimatorInputs(
            householdSize: seed.householdSize,
            elderlyOrDisabled: seed.elderlyOrDisabled,
            grossMonthlyIncome: seed.grossMonthlyIncome,
            monthlyRent: seed.monthlyRent,
            paysUtilitiesSeparately: seed.paysUtilitiesSeparately
        ))
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    private var outcome: SNAPBenefitEstimatorOutcome {
        SNAPBenefitEstimatorCalculator.calculate(inputs)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Inputs (+ the math link + disclaimer footnote) scroll
            // above the pinned result card. Only the live estimate
            // and the Apply CTA stay always-visible at the bottom —
            // everything else lives in the scroll area so the
            // sticky footer doesn't dominate the screen.
            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    header
                    inputsSection
                    // When eligible: combined "See how we calculated
                    // this · Civica's estimate, state decides." line
                    // (one tappable row, opens math sheet). When
                    // ineligible: math sheet doesn't apply, so fall
                    // back to the plain disclaimer + BBCE soft note.
                    if case .eligible = outcome {
                        seeTheMathButton
                    } else {
                        Text(SNAPBenefitEstimatorStrings.disclaimerFooter.value(in: language))
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(SNAPBenefitEstimatorStrings.bbceSoftNote.value(in: language))
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, CivicaSpacing.xl)
                .padding(.top, CivicaSpacing.lg)
                .padding(.bottom, CivicaSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            stickyResultFooter
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .toolbar {
            if let onClose {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .foregroundStyle(CivicaColors.ink)
                    }
                    .accessibilityLabel(SNAPBenefitEstimatorStrings.closeLabel.value(in: language))
                }
            }
        }
        .sheet(isPresented: $showsMath) {
            NavigationStack {
                SNAPDecisionMathView(
                    result: synthesizedResult,
                    language: language,
                    onContinue: nil
                )
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        // Subtitle dropped per UX feedback — the live-update behavior
        // is now self-evident with the sticky result footer visible
        // at all times. Title only.
        Text(SNAPBenefitEstimatorStrings.pageTitle.value(in: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Inputs

    private var inputsSection: some View {
        VStack(spacing: CivicaSpacing.sm) {
            householdSizeCard
            incomeCard
            rentCard
            // Both elderly/disabled and utilities are short yes/no
            // questions with single-tap affordances. Pairing them in
            // a 2-column row reclaims ~80pt of vertical space without
            // crowding either question. Each card stays full-width
            // inside its column so the typography still has room to
            // breathe.
            HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                elderlyOrDisabledCard
                utilitiesCard
            }
        }
    }

    private var householdSizeCard: some View {
        inputCard(
            question: SNAPBenefitEstimatorStrings.householdSizeQuestion.value(in: language),
            helper: SNAPBenefitEstimatorStrings.householdSizeHelper.value(in: language)
        ) {
            HStack(spacing: CivicaSpacing.lg) {
                stepperButton(
                    systemName: "minus",
                    a11yLabel: SNAPBenefitEstimatorStrings.householdDecreaseLabel.value(in: language),
                    enabled: inputs.householdSize > SNAPBenefitEstimatorCalculator.householdSizeRange.lowerBound
                ) {
                    inputs.householdSize = max(
                        SNAPBenefitEstimatorCalculator.householdSizeRange.lowerBound,
                        inputs.householdSize - 1
                    )
                }

                Text(householdSizeDisplay)
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .frame(minWidth: 48)
                    .accessibilityLabel("\(inputs.householdSize)")

                stepperButton(
                    systemName: "plus",
                    a11yLabel: SNAPBenefitEstimatorStrings.householdIncreaseLabel.value(in: language),
                    enabled: inputs.householdSize < SNAPBenefitEstimatorCalculator.householdSizeRange.upperBound
                ) {
                    inputs.householdSize = min(
                        SNAPBenefitEstimatorCalculator.householdSizeRange.upperBound,
                        inputs.householdSize + 1
                    )
                }

                Spacer()
            }
        }
    }

    private var householdSizeDisplay: String {
        inputs.householdSize >= SNAPBenefitEstimatorCalculator.householdSizeRange.upperBound
            ? "\(inputs.householdSize)+"
            : "\(inputs.householdSize)"
    }

    private var elderlyOrDisabledCard: some View {
        // Lives in the 2-column row; the longer-form helper is
        // dropped here to keep the card compact. The question
        // alone is unambiguous at the shortened length.
        inputCard(
            question: SNAPBenefitEstimatorStrings.elderlyOrDisabledQuestion.value(in: language)
        ) {
            yesNoToggle(isOn: $inputs.elderlyOrDisabled)
        }
    }

    private var incomeCard: some View {
        inputCard(
            question: SNAPBenefitEstimatorStrings.incomeQuestion.value(in: language),
            helper: SNAPBenefitEstimatorStrings.incomeHelper.value(in: language)
        ) {
            currencySlider(
                value: $inputs.grossMonthlyIncome,
                range: SNAPBenefitEstimatorCalculator.incomeSliderRange,
                step: 50,
                denominator: language == .english ? "mo" : "mes"
            )
        }
    }

    private var rentCard: some View {
        inputCard(
            question: SNAPBenefitEstimatorStrings.rentQuestion.value(in: language),
            helper: SNAPBenefitEstimatorStrings.rentHelper.value(in: language)
        ) {
            currencySlider(
                value: $inputs.monthlyRent,
                range: SNAPBenefitEstimatorCalculator.rentSliderRange,
                step: 50,
                denominator: language == .english ? "mo" : "mes"
            )
        }
    }

    private var utilitiesCard: some View {
        // Helper subtitle dropped per device-QA feedback (2026-05-31):
        // the "electric, gas, or heating… even one qualifies" line read
        // as clutter in the 2-col row. The question "Pay utilities
        // separately?" stands on its own.
        inputCard(
            question: SNAPBenefitEstimatorStrings.utilitiesQuestion.value(in: language)
        ) {
            yesNoToggle(isOn: $inputs.paysUtilitiesSeparately)
        }
    }

    // MARK: - Sticky result footer

    /// Pins ONLY the live result card and the Apply CTA to the
    /// bottom of the screen. The math link + disclaimer footnote
    /// live in the scroll area above so the sticky footer stays
    /// roughly one-third of the screen instead of half. The
    /// estimator's value-prop is real-time recalculation as the
    /// user fiddles — keeping just the result + primary action
    /// in view is enough to deliver that.
    private var stickyResultFooter: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if isRulesSnapshotExpired {
                staleRulesBanner
            }
            resultCard
            // The soft-ineligibility card (IS-4 / UD-3) carries its own
            // Apply-Anyway row, so the standalone Apply CTA below would
            // double up. Suppress it in the ineligible case; eligible
            // outcomes keep the bottom-of-screen CTA.
            if case .eligible = outcome {
                applyCTA
            }
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.top, CivicaSpacing.sm)
        .padding(.bottom, CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.paper)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(CivicaColors.hairline)
                .frame(height: 1)
        }
    }

    // MARK: - Stale-rules banner (OBBBA Q12)

    /// True when the active rules-engine snapshot has passed its
    /// effective window. Read via the same `static let rules` that
    /// powers every threshold lookup, so the banner cannot drift
    /// out of sync with what the calculator actually used.
    private var isRulesSnapshotExpired: Bool {
        switch SNAPBenefitEstimatorCalculator.rules.snapshotStatus(asOf: Date()) {
        case .current: return false
        case .expired: return true
        }
    }

    private var staleRulesBanner: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack(spacing: CivicaSpacing.xs) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(CivicaColors.destructive)
                    .accessibilityHidden(true)
                Text(SNAPBenefitEstimatorStrings.staleRulesHeadline.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.destructive)
            }
            Text(SNAPBenefitEstimatorStrings.staleRulesBody.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Result card

    @ViewBuilder
    private var resultCard: some View {
        switch outcome {
        case .eligible(let monthlyBenefit, let annual, _):
            eligibleResultCard(monthly: monthlyBenefit, annual: annual)
        case .ineligible(let reason, _):
            ineligibleResultCard(reason: reason)
        }
    }

    private func eligibleResultCard(monthly: Decimal, annual: Decimal) -> some View {
        // Compact result card: eyebrow + monthly-and-annual on a
        // single line. The monthly amount is the focal point
        // (pageTitle weight + brick primary tint); the annual
        // rollup trails right-aligned in subhead graphite so it
        // reads as a quieter "by the way, that's $X a year" without
        // claiming a whole row to itself.
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPBenefitEstimatorStrings.resultEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.md) {
                // Monetary focal point is a *positive outcome* — per
                // the HANDOFF palette spec, accentTeal is reserved
                // for "deltas, success, on-target SLA." A SNAP
                // benefit estimate qualifies as a success signal,
                // so the dollar amount lands in teal instead of
                // brick. Brick stays exclusively on tap-able
                // action affordances (the Apply CTA below).
                CivicaMoney(
                    amount: monthly,
                    denominator: language == .english ? "mo" : "mes",
                    font: CivicaTypography.display
                )
                .foregroundStyle(CivicaColors.amberPrimary)
                // Roll the number when the estimate changes as the
                // user moves a slider — makes the live-calc feel
                // responsive rather than a static snap to new value.
                .contentTransition(.numericText())
                // MARK: - REDUCE-MOTION EXEMPT — numericText counter spring
                // physics is tied to a specific bouncy feel that snaps look
                // jarring under (audit RA-4 explicit exception 2026-05-29).
                .animation(.spring(response: 0.25, dampingFraction: 0.8), value: monthly)

                Spacer(minLength: 0)

                HStack(spacing: 2) {
                    Text(SNAPBenefitEstimatorStrings.resultAnnualLabel.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                    CivicaMoney(amount: annual, font: CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .contentTransition(.numericText())
                        // REDUCE-MOTION EXEMPT — numericText counter spring (see above).
                        .animation(.spring(response: 0.25, dampingFraction: 0.8), value: annual)
                    Text("/" + (language == .english ? "yr" : "año"))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
                .fixedSize()
            }

            // Federal-vs-state clarifier. Top-of-funnel estimator
            // intentionally runs federal rules — call that out so
            // the full state application's different number isn't a
            // surprise.
            Text(SNAPBenefitEstimatorStrings.federalEstimateNote(stateCode: nil, language: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            // Source-citation footer — defensibility surface. If a user
            // appeals a state determination and screenshots the app, the
            // FY + COLA source is visible without opening the math sheet.
            Text(SNAPBenefitEstimatorStrings.citationFooter.value(in: language))
                .font(CivicaTypography.caption)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        // amberSurface (warm pastel wash) so the result card reads as
        // "positive outcome" in the warm palette — amber gold signals
        // benefit/money rather than the removed accentTeal.
        .background(CivicaColors.amberSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func ineligibleResultCard(reason: SNAPBenefitEstimatorIneligibilityReason) -> some View {
        // IS-4 + UD-3 (audit 2026-05-29): the prior red destructive
        // card read as a door slam on what's already the highest-emotion
        // moment in the flow. Replaced with the shared warm-but-honest
        // SNAPSoftIneligibilityCard, which surfaces three explicit
        // next-step rows (Apply Anyway → CivicaSNAPFlowView, Find Food
        // → FindHelpRootView, Open the State Portal → Safari sheet).
        // Eyebrow + citation footer are dropped here — the card's own
        // confidence line ("Based on what you told us. The county makes
        // the final decision.") carries the same defensibility signal.
        SNAPSoftIneligibilityCard(
            verdictReason: ineligibleContextLine(reason: reason),
            language: language,
            onApplyAnyway: { onApply() },
            onFindHelp: { onFindHelp?() },
            onOpenStatePortal: { onOpenStatePortal?() }
        )
    }

    private func ineligibleContextLine(reason: SNAPBenefitEstimatorIneligibilityReason) -> CivicaText {
        switch reason {
        case .grossIncomeOverLimit:
            return SNAPBenefitEstimatorStrings.ineligibleContextGrossOver
        case .netIncomeOverLimit:
            return SNAPBenefitEstimatorStrings.ineligibleContextNetOver
        case .benefitBelowMinThreshold:
            return SNAPBenefitEstimatorStrings.ineligibleContextBelowMin
        }
    }

    // MARK: - CTAs

    private var applyCTA: some View {
        // Compliance row 5 (estimator_apply_cta): counsel-prep approved
        // (2026-05-19) — "Apply on BenefitsCal" (CA launch). The
        // isExternalLink affordance is intentionally NOT set here:
        // onApply() routes into the Civica in-app screener
        // (SNAPEstimatorFlowView → CivicaSNAPFlowView), not directly
        // to a browser. The external-link icon would mislead users into
        // expecting a browser tab to open. State-aware label via the
        // registry; falls back to generic "Apply for SNAP" if reverted.
        CivicaPrimaryButton(
            SNAPBenefitEstimatorStrings.applyCTA(stateCode: nil, language: language)
        ) {
            persistEligibleResultIfNeeded()
            onApply()
        }
    }

    private func persistEligibleResultIfNeeded() {
        if case .eligible(let monthlyBenefit, _, _) = outcome {
            SNAPEstimatorResultStore().save(monthlyBenefit: monthlyBenefit)
        }
    }

    /// Combined math link + disclaimer on a single line per UX
    /// feedback. The math link reads as the tappable foreground;
    /// the disclaimer trails after a middot in graphite footnote
    /// type. Tapping anywhere on the row opens the math sheet —
    /// the disclaimer half is informational only but sharing the
    /// hit target avoids a second tap target competing for thumb.
    private var seeTheMathButton: some View {
        Button {
            showsMath = true
        } label: {
            (
                Text(SNAPBenefitEstimatorStrings.seeTheMathLink.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.pinePrimary)
                + Text("  ·  ")
                    .font(CivicaTypography.footnote)
                    .foregroundColor(CivicaColors.graphite)
                + Text(SNAPBenefitEstimatorStrings.disclaimerFooter.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundColor(CivicaColors.graphite)
            )
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(SNAPBenefitEstimatorStrings.seeTheMathLink.value(in: language)). \(SNAPBenefitEstimatorStrings.disclaimerFooter.value(in: language))")
    }

    /// Disclaimer is now merged into seeTheMathButton. Kept as an
    /// empty stub so any external caller that expected this symbol
    /// still compiles; the body returns an empty view.
    private var disclaimerFooter: some View {
        EmptyView()
    }

    // MARK: - Synthesized result for the math-expansion sheet

    private var synthesizedResult: SNAPEligibilityResult {
        let detail = outcome.detail
        let isEligible: Bool
        if case .eligible = outcome { isEligible = true } else { isEligible = false }
        return SNAPEligibilityResult(
            status: isEligible ? .eligible : .ineligible,
            monthlyBenefit: isEligible ? detail.monthlyBenefit : nil,
            expeditedEligible: false,
            contributingFactors: ["local_estimator"],
            requiredVerifications: [],
            benefitCalculation: detail,
            ineligibilityReason: isEligible ? nil : SNAPBenefitEstimatorStrings.ineligibleHeadline.value(in: language),
            effectiveDate: SNAPBenefitEstimatorCalculator.effectiveDate,
            rulesVersion: SNAPBenefitEstimatorCalculator.rulesVersion
        )
    }

    // MARK: - Building blocks

    /// `helper` is optional. The two yes/no cards in the merged
    /// 2-column row drop their helpers to keep each side compact;
    /// the slider / stepper cards keep theirs since the input
    /// expression itself doesn't telegraph the answer's meaning.
    private func inputCard<Content: View>(
        question: String,
        helper: String? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(question)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let helper, !helper.isEmpty {
                Text(helper)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            content()
                .padding(.top, CivicaSpacing.xs)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    /// Utility +/- controls — demoted from brick to graphite so the
    /// Apply CTA below is the only brick action on the screen. The
    /// stepper is a utility control, not a primary action; tinting
    /// it brick competed with the CTA for the user's eye. The faint
    /// surface fill is now a hairline-tinted neutral so the affordance
    /// reads as "tap-able utility" without claiming brand color.
    private func stepperButton(
        systemName: String,
        a11yLabel: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(enabled ? CivicaColors.graphite : CivicaColors.muted)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(CivicaColors.ink.opacity(enabled ? 0.06 : 0.03))
                )
        }
        .disabled(!enabled)
        .accessibilityLabel(a11yLabel)
    }

    private func yesNoToggle(isOn: Binding<Bool>) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Text(SNAPBenefitEstimatorStrings.toggleNo.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(isOn.wrappedValue ? CivicaColors.graphite : CivicaColors.ink)
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(CivicaColors.pinePrimary)
            Text(SNAPBenefitEstimatorStrings.toggleYes.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(isOn.wrappedValue ? CivicaColors.ink : CivicaColors.graphite)
            Spacer()
        }
    }

    private func currencySlider(
        value: Binding<Decimal>,
        range: ClosedRange<Decimal>,
        step: Double,
        denominator: String
    ) -> some View {
        let doubleBinding = Binding<Double>(
            get: { NSDecimalNumber(decimal: value.wrappedValue).doubleValue },
            set: { value.wrappedValue = Decimal($0) }
        )
        let lower = NSDecimalNumber(decimal: range.lowerBound).doubleValue
        let upper = NSDecimalNumber(decimal: range.upperBound).doubleValue

        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            CivicaMoney(
                amount: value.wrappedValue,
                denominator: denominator,
                font: CivicaTypography.cardTitle
            )
            .foregroundStyle(CivicaColors.ink)

            Slider(value: doubleBinding, in: lower...upper, step: step)
                .tint(CivicaColors.pinePrimary)

            HStack {
                CivicaMoney(amount: range.lowerBound, font: CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.muted)
                Spacer()
                CivicaMoney(amount: range.upperBound, font: CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.muted)
            }
        }
    }
}

#if DEBUG
struct SNAPBenefitEstimatorView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            NavigationStack {
                SNAPBenefitEstimatorView(
                    onApply: { print("Apply tapped") },
                    onClose: { print("Close tapped") }
                )
            }
            .previewDisplayName("Default · English")

            NavigationStack {
                SNAPBenefitEstimatorView(
                    onApply: {},
                    onClose: nil,
                    initialState: SNAPBenefitEstimatorView.InitialState(
                        householdSize: 2,
                        elderlyOrDisabled: false,
                        grossMonthlyIncome: 4_800,
                        monthlyRent: 1_200,
                        paysUtilitiesSeparately: true
                    )
                )
            }
            .previewDisplayName("Ineligible · gross over 130% FPL")
        }
    }
}
#endif
