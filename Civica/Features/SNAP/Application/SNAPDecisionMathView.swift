import CivicaDesignSystem
import SwiftUI

// HANDOFF board 23 — "Decision · partial · the math, exposed."
//
// Renders every step of the SNAP benefit calculation so the user
// can see exactly how Civica arrived at their estimated benefit.
// This is the trust artifact: no hidden steps, no rounding without
// showing it, no implied math.
//
// Layout, top to bottom:
//   1. Verdict header   — big monthly-benefit number using CivicaMoney
//   2. Income line      — gross monthly income
//   3. Deduction lines  — one row per deduction, only shown if nonzero
//   4. Net income line  — emphasized horizontal rule above
//   5. 30% of net line  — the SNAP-specific math step
//   6. Max allotment + final benefit — boxed in Brick surface
//   7. Sources footer   — rules version + effective date for audit
//
// Money formatting: every dollar amount routes through CivicaMoney,
// which is the only correct formatter for currency in the app
// (HANDOFF.md money rule: tabular-nums, denominator everywhere).

struct SNAPDecisionMathView: View {
    let result: SNAPEligibilityResult
    let language: CivicaLanguage
    let onContinue: (() -> Void)?
    /// Optional draft used to personalize the levers section
    /// ("Three things that could change this"). When nil, the view
    /// hydrates the latest persisted draft from disk so the levers
    /// still appear correctly when the math view is reached via
    /// the returning-user-home "View my result" card.
    let draft: SNAPApplicationDraft?

    @State private var showsRawRulesVersion = false

    init(
        result: SNAPEligibilityResult,
        language: CivicaLanguage = .english,
        onContinue: (() -> Void)? = nil,
        draft: SNAPApplicationDraft? = nil
    ) {
        self.result = result
        self.language = language
        self.onContinue = onContinue
        self.draft = draft
    }

    private var resolvedDraft: SNAPApplicationDraft? {
        if let draft { return draft }
        return SNAPApplicationDraftStore().load()?.draft
    }

    /// Sync triage result derived from whatever draft is available.
    /// Returns nil when there's no draft to score — the banner is
    /// then hidden. This view's parent doesn't own the orchestrator's
    /// @Published triageResult, so the math view computes its own.
    private var triageResult: ExpeditedTriageResult? {
        guard let draft = resolvedDraft else { return nil }
        return evaluateTriageSynchronously(draft: draft)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                verdictHeader

                SNAPExpeditedBanner(
                    result: triageResult,
                    draft: resolvedDraft,
                    language: language
                )

                if let calc = result.benefitCalculation {
                    mathSection(calc)
                }

                if SNAPDecisionLeversView.shouldRender(for: result) {
                    SNAPDecisionLeversView(
                        result: result,
                        draft: resolvedDraft,
                        language: language
                    )
                }

                if SNAPCrossProgramTeaserView.shouldRender(for: resolvedDraft) {
                    SNAPCrossProgramTeaserView(
                        draft: resolvedDraft,
                        language: language
                    )
                }

                sourcesFooter

                if onContinue != nil {
                    continueButton
                }
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(SNAPDecisionMathStrings.pageTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Sections

    private var verdictHeader: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(headlineText)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(verdictAccentColor)
                .accessibilityAddTraits(.isHeader)

            if let monthlyBenefit = result.monthlyBenefit, result.status == .eligible {
                CivicaMoney(
                    amount: monthlyBenefit,
                    denominator: language == .english ? "mo" : "mes",
                    font: CivicaTypography.pageTitle
                )
                // Positive-outcome money lives in teal across the app
                // (matches the estimator's eligible result card).
                .foregroundStyle(CivicaColors.accentTeal)
            } else if let reason = result.ineligibilityReason {
                Text(reason)
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(SNAPDecisionMathStrings.estimateDisclaimer.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func mathSection(_ calc: SNAPBenefitCalculationDetail) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPDecisionMathStrings.sectionHowWeCalc.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            VStack(spacing: 0) {
                mathRow(
                    label: SNAPDecisionMathStrings.grossMonthlyIncome.value(in: language),
                    amount: calc.grossMonthlyIncome,
                    operation: nil
                )

                if calc.earnedIncomeDeduction > 0 {
                    mathRow(
                        label: SNAPDecisionMathStrings.earnedIncomeDeduction.value(in: language),
                        amount: calc.earnedIncomeDeduction,
                        operation: .subtract
                    )
                }
                if calc.standardDeduction > 0 {
                    mathRow(
                        label: SNAPDecisionMathStrings.standardDeduction.value(in: language),
                        amount: calc.standardDeduction,
                        operation: .subtract
                    )
                }
                if calc.dependentCareDeduction > 0 {
                    mathRow(
                        label: SNAPDecisionMathStrings.dependentCareDeduction.value(in: language),
                        amount: calc.dependentCareDeduction,
                        operation: .subtract
                    )
                }
                if calc.medicalDeduction > 0 {
                    mathRow(
                        label: SNAPDecisionMathStrings.medicalDeduction.value(in: language),
                        amount: calc.medicalDeduction,
                        operation: .subtract
                    )
                }
                if calc.childSupportDeduction > 0 {
                    mathRow(
                        label: SNAPDecisionMathStrings.childSupportDeduction.value(in: language),
                        amount: calc.childSupportDeduction,
                        operation: .subtract
                    )
                }
                if calc.excessShelterDeduction > 0 {
                    mathRow(
                        label: SNAPDecisionMathStrings.excessShelterDeduction.value(in: language),
                        amount: calc.excessShelterDeduction,
                        operation: .subtract
                    )
                }

                Divider()
                    .background(CivicaColors.ink)
                    .padding(.vertical, CivicaSpacing.xs)

                mathRow(
                    label: SNAPDecisionMathStrings.netMonthlyIncome.value(in: language),
                    amount: calc.netMonthlyIncome,
                    operation: .equals,
                    emphasis: true
                )

                mathRow(
                    label: SNAPDecisionMathStrings.thirtyPercentOfNet.value(in: language),
                    amount: calc.thirtyPercentOfNet,
                    operation: .multiply
                )
            }
            .padding(CivicaSpacing.md)
            .background(CivicaColors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))

            // Final benefit box — Brick surface so the answer is unmissable
            finalBenefitBox(calc)
        }
    }

    private func finalBenefitBox(_ calc: SNAPBenefitCalculationDetail) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack {
                Text(SNAPDecisionMathStrings.maxAllotment.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
                CivicaMoney(amount: calc.maxAllotmentForHouseholdSize, font: CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.ink)
            }
            HStack {
                Text("− " + SNAPDecisionMathStrings.thirtyPercentOfNet.value(in: language))
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.graphite)
                Spacer()
                CivicaMoney(amount: calc.thirtyPercentOfNet, font: CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Divider().background(CivicaColors.ink)
            HStack(alignment: .firstTextBaseline) {
                Text(SNAPDecisionMathStrings.monthlyBenefit.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
                CivicaMoney(
                    amount: calc.monthlyBenefit,
                    denominator: language == .english ? "mo" : "mes",
                    font: CivicaTypography.cardTitle
                )
                .foregroundStyle(CivicaColors.accentTeal)
            }
        }
        .padding(CivicaSpacing.lg)
        // Match the estimator's eligible card — tealSurface tints
        // the positive-outcome summary; brickSurface is reserved
        // for warm decorative tints that aren't outcome cards.
        .background(CivicaColors.tealSurface)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(finalBenefitAccessibilityLabel(calc))
    }

    private var sourcesFooter: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPDecisionMathStrings.sectionSources.value(in: language))
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            HStack {
                Text(SNAPDecisionMathStrings.rulesVersion.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                Spacer()
                rulesVersionValue
            }
            HStack {
                Text(SNAPDecisionMathStrings.effectiveAsOf.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                Spacer()
                Text(result.effectiveDate)
                    .font(CivicaTypography.footnote.monospacedDigit())
                    .foregroundStyle(CivicaColors.ink)
            }
        }
        .padding(.top, CivicaSpacing.md)
    }

    private var continueButton: some View {
        CivicaPrimaryButton(SNAPDecisionMathStrings.continueToPacket.value(in: language)) {
            onContinue?()
        }
    }

    // MARK: - Rules-version display
    //
    // The rules-version stamp is set by either the local Swift
    // evaluator (`local-eval-FY26/MA-bbce-200pct`) or the backend
    // rules engine (`federal-2025-05-10/MA-2025-05-10`). Both formats
    // are debugger-friendly but not user-friendly. Show a humanized
    // label by default; let the user tap to reveal the raw stamp so
    // a support tech can read it back over a phone call.

    private var rulesVersionValue: some View {
        let humanized = Self.humanizedRulesVersion(result.rulesVersion, language: language)
        let display = showsRawRulesVersion || humanized == nil ? result.rulesVersion : humanized!
        return Button {
            showsRawRulesVersion.toggle()
        } label: {
            Text(display)
                .font(
                    showsRawRulesVersion || humanized == nil
                    ? CivicaTypography.footnote.monospacedDigit()
                    : CivicaTypography.footnote
                )
                .foregroundStyle(CivicaColors.ink)
                .multilineTextAlignment(.trailing)
        }
        .buttonStyle(.plain)
        .disabled(humanized == nil)
        .accessibilityLabel(display)
        .accessibilityHint(
            humanized == nil
            ? ""
            : (showsRawRulesVersion
                ? SNAPDecisionMathStrings.rulesVersionHintHumanize.value(in: language)
                : SNAPDecisionMathStrings.rulesVersionHintReveal.value(in: language))
        )
    }

    /// Parse a known rules-version stamp into a human-readable label.
    /// Returns nil for unrecognized formats so the caller can fall back
    /// to displaying the raw stamp.
    static func humanizedRulesVersion(_ stamp: String, language: CivicaLanguage) -> String? {
        if let local = humanizedLocalEval(stamp) {
            return local
        }
        if let federal = humanizedFederal(stamp, language: language) {
            return federal
        }
        return nil
    }

    /// `local-eval-FY26/MA-bbce-200pct` → `FY2026 · Massachusetts (200% BBCE)`
    private static func humanizedLocalEval(_ stamp: String) -> String? {
        let prefix = "local-eval-"
        guard stamp.hasPrefix(prefix) else { return nil }
        let body = stamp.dropFirst(prefix.count)
        let halves = body.split(separator: "/", maxSplits: 1, omittingEmptySubsequences: false)
        guard halves.count == 2 else { return nil }
        let cycleRaw = String(halves[0])
        let stateBlock = halves[1].split(separator: "-")
        guard stateBlock.count >= 3 else { return nil }
        let stateAbbr = String(stateBlock[0])
        let logic = String(stateBlock[1]).uppercased()
        let threshold = String(stateBlock[2])

        let cycle: String
        if cycleRaw.hasPrefix("FY"), cycleRaw.count == 4 {
            cycle = "FY20" + cycleRaw.dropFirst(2)
        } else {
            cycle = cycleRaw
        }

        let thresholdHuman: String
        if threshold.hasSuffix("pct"), let n = Int(threshold.dropLast(3)) {
            thresholdHuman = "\(n)%"
        } else {
            thresholdHuman = threshold
        }

        return "\(cycle) · \(stateFullName(stateAbbr)) (\(thresholdHuman) \(logic))"
    }

    /// `federal-2025-05-10/MA-2025-05-10` → `Federal rules · Massachusetts (May 2025)`
    private static func humanizedFederal(_ stamp: String, language: CivicaLanguage) -> String? {
        let prefix = "federal-"
        guard stamp.hasPrefix(prefix) else { return nil }
        let body = stamp.dropFirst(prefix.count)
        let halves = body.split(separator: "/", maxSplits: 1, omittingEmptySubsequences: false)
        guard halves.count == 2 else { return nil }
        let federalDate = String(halves[0])
        let stateParts = halves[1].split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        guard stateParts.count == 2 else { return nil }
        let stateAbbr = String(stateParts[0])
        let monthYear = monthYearLabel(from: federalDate, language: language) ?? federalDate
        let federalLabel = language == .english ? "Federal rules" : "Reglas federales"
        return "\(federalLabel) · \(stateFullName(stateAbbr)) (\(monthYear))"
    }

    private static func stateFullName(_ abbr: String) -> String {
        switch abbr.uppercased() {
        case "MA": return "Massachusetts"
        default: return abbr
        }
    }

    private static func monthYearLabel(from yyyyMMdd: String, language: CivicaLanguage) -> String? {
        let inFmt = DateFormatter()
        inFmt.dateFormat = "yyyy-MM-dd"
        inFmt.locale = Locale(identifier: "en_US_POSIX")
        guard let date = inFmt.date(from: yyyyMMdd) else { return nil }
        let outFmt = DateFormatter()
        outFmt.locale = Locale(identifier: language == .english ? "en_US" : "es_US")
        outFmt.dateFormat = "MMMM yyyy"
        return outFmt.string(from: date)
    }

    // MARK: - Rows

    private enum Operation {
        case subtract
        case multiply
        case equals
        case add

        var symbol: String {
            switch self {
            case .subtract: return "−"
            case .multiply: return "×"
            case .equals:   return "="
            case .add:      return "+"
            }
        }

        var spoken: String {
            switch self {
            case .subtract: return "minus"
            case .multiply: return "times"
            case .equals:   return "equals"
            case .add:      return "plus"
            }
        }
    }

    private func mathRow(
        label: String,
        amount: Decimal,
        operation: Operation?,
        emphasis: Bool = false
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
            if let operation {
                Text(operation.symbol)
                    .font(CivicaTypography.subhead.monospacedDigit())
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(width: 16, alignment: .leading)
                    .accessibilityHidden(true)
            } else {
                Spacer().frame(width: 16)
            }
            Text(label)
                .font(emphasis ? CivicaTypography.subheadStrong : CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.ink)
            Spacer()
            CivicaMoney(amount: amount, font: emphasis ? CivicaTypography.subheadStrong : CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.ink)
        }
        .padding(.vertical, CivicaSpacing.xs)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rowAccessibilityLabel(label: label, amount: amount, operation: operation))
    }

    // MARK: - Accessibility / formatting helpers

    private func rowAccessibilityLabel(label: String, amount: Decimal, operation: Operation?) -> String {
        let opPrefix = operation.map { "\($0.spoken) " } ?? ""
        let amountSpoken = CivicaMoney(amount: amount, denominator: nil).accessibilityValueForVoiceOver
        return "\(opPrefix)\(label), \(amountSpoken)"
    }

    private func finalBenefitAccessibilityLabel(_ calc: SNAPBenefitCalculationDetail) -> String {
        let monthlyAmount = CivicaMoney(
            amount: calc.monthlyBenefit,
            denominator: language == .english ? "mo" : "mes"
        ).accessibilityValueForVoiceOver
        return "\(SNAPDecisionMathStrings.monthlyBenefit.value(in: language)), \(monthlyAmount)"
    }

    private var headlineText: String {
        switch result.status {
        case .eligible, .eligibleWithConditions:
            return SNAPDecisionMathStrings.headlineEligible.value(in: language)
        case .ineligible:
            return SNAPDecisionMathStrings.headlineIneligible.value(in: language)
        case .insufficientInformation:
            return SNAPDecisionMathStrings.headlineInsufficient.value(in: language)
        }
    }

    private var verdictAccentColor: Color {
        switch result.status {
        case .eligible, .eligibleWithConditions:
            return CivicaColors.accentTeal
        case .ineligible:
            return CivicaColors.destructive
        case .insufficientInformation:
            return CivicaColors.warningAmber
        }
    }
}

// Local extension to expose CivicaMoney's spoken label for compound
// accessibility strings on this view. CivicaMoney's spokenLabel is
// private; we re-derive a small subset here. When we promote this
// view back into the design system, fold this into CivicaMoney's
// public API.
private extension CivicaMoney {
    var accessibilityValueForVoiceOver: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        formatter.locale = .current
        let amountText = formatter.string(from: amount as NSDecimalNumber) ?? "zero"
        let core = "\(amountText) dollars"
        guard let denominator, !denominator.isEmpty else { return core }
        let unit: String
        switch denominator.lowercased() {
        case "mo", "month", "mes": unit = "per month"
        default: unit = "per \(denominator)"
        }
        return "\(core) \(unit)"
    }
}

#if DEBUG
struct SNAPDecisionMathView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            SNAPDecisionMathView(
                result: SNAPEligibilityResult(
                    status: .eligible,
                    monthlyBenefit: 135,
                    expeditedEligible: false,
                    contributingFactors: ["ma_bbce_applied"],
                    requiredVerifications: [],
                    benefitCalculation: SNAPBenefitCalculationDetail(
                        grossMonthlyIncome: 1800,
                        earnedIncomeDeduction: 360,
                        standardDeduction: 204,
                        dependentCareDeduction: 0,
                        medicalDeduction: 0,
                        childSupportDeduction: 0,
                        excessShelterDeduction: 712,
                        netMonthlyIncome: 524,
                        thirtyPercentOfNet: 157,
                        maxAllotmentForHouseholdSize: 292,
                        monthlyBenefit: 135
                    ),
                    ineligibilityReason: nil,
                    effectiveDate: "2025-05-10",
                    rulesVersion: "federal-2025-05-10/MA-2025-05-10"
                ),
                language: .english,
                onContinue: {}
            )
        }
    }
}
#endif
