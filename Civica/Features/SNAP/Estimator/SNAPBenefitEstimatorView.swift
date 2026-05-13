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

    @State private var inputs: SNAPBenefitEstimatorInputs
    @State private var showsMath: Bool = false
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    init(
        onApply: @escaping () -> Void,
        onClose: (() -> Void)? = nil,
        initialState: InitialState? = nil
    ) {
        self.onApply = onApply
        self.onClose = onClose
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
        // Lives in the 2-column row alongside elderlyOrDisabledCard.
        // Same compact treatment — helper dropped, short question
        // only.
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
            resultCard
            applyCTA
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
                CivicaMoney(
                    amount: monthly,
                    denominator: language == .english ? "mo" : "mes",
                    font: CivicaTypography.pageTitle
                )
                .foregroundStyle(CivicaColors.brickPrimary)

                Spacer(minLength: 0)

                HStack(spacing: 2) {
                    Text(SNAPBenefitEstimatorStrings.resultAnnualLabel.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                    CivicaMoney(amount: annual, font: CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                    Text("/" + (language == .english ? "yr" : "año"))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
                .fixedSize()
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func ineligibleResultCard(reason: SNAPBenefitEstimatorIneligibilityReason) -> some View {
        // Compact mirror of the eligible card. Headline + one-line
        // context. The BBCE soft note (worth-applying-anyway encouragement)
        // moves to the scroll area above so it doesn't double the
        // height of the sticky footer when the user's inputs land
        // them in the ineligible band.
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPBenefitEstimatorStrings.resultEyebrow.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            Text(SNAPBenefitEstimatorStrings.ineligibleHeadline.value(in: language))
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.destructive)

            Text(ineligibleContextLine(reason: reason))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private func ineligibleContextLine(reason: SNAPBenefitEstimatorIneligibilityReason) -> String {
        switch reason {
        case .grossIncomeOverLimit:
            return SNAPBenefitEstimatorStrings.ineligibleContextGrossOver.value(in: language)
        case .netIncomeOverLimit:
            return SNAPBenefitEstimatorStrings.ineligibleContextNetOver.value(in: language)
        case .benefitBelowMinThreshold:
            return SNAPBenefitEstimatorStrings.ineligibleContextBelowMin.value(in: language)
        }
    }

    // MARK: - CTAs

    private var applyCTA: some View {
        CivicaPrimaryButton(SNAPBenefitEstimatorStrings.applyCTA.value(in: language)) {
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
                    .foregroundColor(CivicaColors.brickPrimary)
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

    private func stepperButton(
        systemName: String,
        a11yLabel: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(enabled ? CivicaColors.brickPrimary : CivicaColors.brickPrimaryDisabled)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .fill(CivicaColors.brickPrimary.opacity(enabled ? 0.12 : 0.06))
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
                .tint(CivicaColors.brickPrimary)
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
                .tint(CivicaColors.brickPrimary)

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
