import CivicaDesignSystem
import SwiftUI

// Migrates the legacy "incomeStep" multi-field card from
// SNAPApplicationView. The legacy form asks ~10 fields on one screen
// (employment status, monthly income, income variability, self-
// employment toggle, employer name, gross pay, pay frequency, hours,
// recent job loss, last pay date, plus unearned-income sub-blocks).
//
// This flow captures the eligibility-critical signal — earned-income
// presence + amount + variability + unearned-income presence — and
// leaves the secondary detail (employer name, exact hours, last pay
// date) for an optional drilldown later. SNAP's rules engine needs
// gross monthly income for the threshold test; the rest is for the
// official PDF and doesn't affect the verdict.
//
// Not wired into SNAPRouter yet — router cutover happens once all
// nine legacy steps are migrated.

enum SNAPTri: String, Equatable, Codable { case yes, no, notSure }

struct SNAPIncomeAnswers: Equatable, Codable {
    typealias Tri = SNAPTri

    var anyoneEarning: Tri?
    var grossMonthlyIncome: Decimal?
    var incomeChangesMonthToMonth: Tri?
    var hasUnearnedIncome: Tri?
    /// Cash on hand + bank account balance — used by 7 CFR 273.2(i)(1)(i)
    /// (< $100 with gross < $150) and 7 CFR 273.2(i)(1)(iii)
    /// (housing > gross + resources). Captured separately from income
    /// because resources and income are distinct regulatory inputs.
    var liquidResources: Decimal?
    /// Whether anyone in the household lost a job in the last 30 days
    /// — a strong soft signal for expedited need.
    var recentJobLoss30d: Tri?
    /// Optional explicit dollar amount of monthly earned income
    /// (wages + self-employment net). Federally the 20% earned-
    /// income deduction only applies to this portion of gross.
    /// The current flow does not yet ask for the split -- when
    /// nil, SNAPBenefitCalculator derives an estimate from
    /// `anyoneEarning` + `hasUnearnedIncome`. A dedicated screen
    /// asking the exact split lands as separate work.
    var monthlyEarnedAmount: Decimal?
    /// Monthly Federal Work-Study (FWS) earnings. Excluded from SNAP
    /// gross income entirely before any deduction math runs, per
    /// 7 CFR 273.9(c)(3). Must be subtracted from grossMonthlyIncome
    /// before passing to SNAPBenefitCalculator.
    var fwsMonthlyAmount: Decimal?

    // Wave 1 — Per-job employer detail. Optional fields the extension
    // can autofill into BenefitsCal's ABEIC page (employer name +
    // address + phone). All optional: an applicant who skips them
    // surfaces a "human must fill" hint to the assister on the
    // packet, instead of blocking advancement. Empty strings = "not
    // provided yet" (matches the existing String defaults pattern).
    var employerName: String = ""
    var employerStreet: String = ""
    var employerCity: String = ""
    var employerState: String = ""
    var employerZIP: String = ""
    var employerPhone: String = ""
}

@MainActor
final class SNAPIncomeFlowViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case earningPresence
        case grossMonthlyIncome
        case employerDetail            // Wave 1 — branched on anyoneEarning == .yes
        case incomeVariability
        case unearnedIncome
        case liquidResources
        case recentJobLoss

        var oneBasedIndex: Int { rawValue + 1 }
        static let total = Self.allCases.count
    }

    enum GrossIncomeEntryMode: Equatable {
        /// Pure typed entry. The only mode when no paystub is on hand.
        case manual
        /// Showing a "From your paystub: $X biweekly ≈ $Y/month" card with
        /// a Use this / Enter a different amount choice.
        case paystubSuggestion(SNAPPaystubDerivation)
    }

    @Published var step: Step = .earningPresence
    @Published var grossIncomeField: String
    @Published var liquidResourcesField: String
    /// Wave D — true once the liquid-resources field has been
    /// populated by a bank-statement scan. Ephemeral, not persisted.
    @Published var liquidResourcesPrefilledFromScan: Bool = false
    @Published var answers: SNAPIncomeAnswers
    /// Derivation from a paystub confirmed earlier in the documents
    /// checklist. Nil when no paystub is available or the derivation
    /// returned nil (missing gross or unresolvable frequency). The
    /// paystub object itself is never stored on the view-model — only
    /// the scalar Decimal derivation.
    @Published private(set) var grossIncomeEntryMode: GrossIncomeEntryMode = .manual
    /// Holds the paystub derivation when the user opts to "Enter a
    /// different amount" — the typed input pre-populates with the
    /// derived value so they can nudge it instead of retyping.
    private var pendingDerivation: SNAPPaystubDerivation?

    init(
        answers: SNAPIncomeAnswers = .init(),
        paystubPrefill: SNAPPaystub? = nil
    ) {
        self.answers = answers
        // Seed the gross-income text field from the stored Decimal so
        // resume / edit shows the prior amount.
        if let gross = answers.grossMonthlyIncome {
            self.grossIncomeField = NSDecimalNumber(decimal: gross).stringValue
        } else {
            self.grossIncomeField = ""
        }
        if let resources = answers.liquidResources {
            self.liquidResourcesField = NSDecimalNumber(decimal: resources).stringValue
        } else {
            self.liquidResourcesField = ""
        }
        // Surface the paystub-suggestion card only when the user hasn't
        // already entered a gross-monthly amount. Once they've typed
        // something, respect that — resumed drafts shouldn't be
        // ambushed by a suggestion overriding their prior answer.
        if let paystub = paystubPrefill,
           answers.grossMonthlyIncome == nil,
           let derivation = SNAPPaystubIncomeDerivation.derive(from: paystub),
           derivation.confidence != .low {
            self.pendingDerivation = derivation
            self.grossIncomeEntryMode = .paystubSuggestion(derivation)
        }
    }

    /// Apply the paystub-derived monthly amount and advance.
    func applyPaystubSuggestion() {
        guard case let .paystubSuggestion(derivation) = grossIncomeEntryMode else { return }
        answers.grossMonthlyIncome = derivation.monthlyEarnedIncome
        answers.monthlyEarnedAmount = derivation.monthlyEarnedIncome
        // Earned-income presence is implied by the existence of a
        // confirmed paystub. Only flip when the user actually accepts
        // the suggestion — not on init — so a "wrong household member"
        // edge case doesn't silently overwrite their explicit "no".
        if answers.anyoneEarning == nil {
            answers.anyoneEarning = .yes
        }
        grossIncomeField = NSDecimalNumber(decimal: derivation.monthlyEarnedIncome).stringValue
        grossIncomeEntryMode = .manual
        if let next = nextStep(after: .grossMonthlyIncome) {
            step = next
        }
    }

    /// Drop the suggestion and reveal the typed input, pre-populated
    /// with the derived value as a starting point.
    func switchToManualEntry() {
        if let derivation = pendingDerivation {
            grossIncomeField = NSDecimalNumber(decimal: derivation.monthlyEarnedIncome).stringValue
        }
        grossIncomeEntryMode = .manual
    }

    /// Skip earned-income subquestions when the user says no one
    /// is earning. They go straight from screen 1 to unearned income,
    /// bypassing gross-income + employer-detail.
    private func nextStep(after current: Step) -> Step? {
        var rawNext = current.rawValue + 1
        if answers.anyoneEarning == .no {
            // From earningPresence → unearnedIncome (skip gross / employer / variability).
            if rawNext == Step.grossMonthlyIncome.rawValue ||
               rawNext == Step.employerDetail.rawValue ||
               rawNext == Step.incomeVariability.rawValue {
                rawNext = Step.unearnedIncome.rawValue
            }
        }
        return Step(rawValue: rawNext)
    }

    private func previousStep(before current: Step) -> Step? {
        var rawPrev = current.rawValue - 1
        if answers.anyoneEarning == .no {
            if rawPrev == Step.incomeVariability.rawValue ||
               rawPrev == Step.employerDetail.rawValue ||
               rawPrev == Step.grossMonthlyIncome.rawValue {
                rawPrev = Step.earningPresence.rawValue
            }
        }
        return Step(rawValue: rawPrev)
    }

    func recordGrossIncomeField() {
        let trimmed = grossIncomeField
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: "")
        answers.grossMonthlyIncome = Decimal(string: trimmed)
    }

    func recordLiquidResourcesField() {
        let trimmed = liquidResourcesField
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: "")
        answers.liquidResources = Decimal(string: trimmed)
    }

    func advance() {
        if step == .grossMonthlyIncome {
            recordGrossIncomeField()
        }
        if step == .liquidResources {
            recordLiquidResourcesField()
        }
        if let next = nextStep(after: step) {
            step = next
        }
    }

    func goBack() {
        if let prev = previousStep(before: step) {
            step = prev
        }
    }

    var canAdvanceFromCurrentStep: Bool {
        switch step {
        case .earningPresence:
            return answers.anyoneEarning != nil
        case .grossMonthlyIncome:
            let trimmed = grossIncomeField.trimmingCharacters(in: .whitespaces)
                .replacingOccurrences(of: ",", with: "")
            return Decimal(string: trimmed) != nil
        case .employerDetail:
            // All employer-detail fields are optional — an applicant
            // who doesn't know their employer's address can still
            // advance. The packet surfaces blank fields as
            // "human must fill" hints to the assister.
            return true
        case .incomeVariability:
            return answers.incomeChangesMonthToMonth != nil
        case .unearnedIncome:
            return answers.hasUnearnedIncome != nil
        case .liquidResources:
            let trimmed = liquidResourcesField.trimmingCharacters(in: .whitespaces)
                .replacingOccurrences(of: ",", with: "")
            return Decimal(string: trimmed) != nil
        case .recentJobLoss:
            return answers.recentJobLoss30d != nil
        }
    }

    var isAtFirstStep: Bool { step == .earningPresence }
    var isAtLastStep: Bool { step == .recentJobLoss }

    /// Unwraps the active paystub suggestion if one is showing.
    /// Used by the view to avoid `if case let` inside @ViewBuilder,
    /// which crashes the Swift compiler on x86_64 CI builds.
    var activeSuggestion: SNAPPaystubDerivation? {
        if case let .paystubSuggestion(derivation) = grossIncomeEntryMode {
            return derivation
        }
        return nil
    }
}

struct SNAPIncomeFlowView: View {
    @StateObject var viewModel: SNAPIncomeFlowViewModel
    let language: CivicaLanguage
    let onComplete: (SNAPIncomeAnswers) -> Void
    let onExit: () -> Void

    init(
        viewModel: SNAPIncomeFlowViewModel,
        language: CivicaLanguage = .english,
        onComplete: @escaping (SNAPIncomeAnswers) -> Void,
        onExit: @escaping () -> Void
    ) {
        self._viewModel = StateObject(wrappedValue: viewModel)
        self.language = language
        self.onComplete = onComplete
        self.onExit = onExit
    }

    var body: some View {
        currentScreen
            .id(viewModel.step)
            .transition(.opacity.animation(.easeInOut(duration: 0.18)))
            .civicaAnimation(.easeInOut(duration: 0.18), value: viewModel.step)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        if viewModel.isAtFirstStep {
                            onExit()
                        } else {
                            civicaWithAnimation(.easeInOut(duration: 0.18)) { viewModel.goBack() }
                        }
                    } label: {
                        Image(systemName: viewModel.isAtFirstStep ? "xmark" : "chevron.left")
                            .foregroundStyle(CivicaColors.ink)
                    }
                    .accessibilityLabel(viewModel.isAtFirstStep
                        ? CivicaQuestionStrings.closeLabel.value(in: language)
                        : CivicaQuestionStrings.backLabel.value(in: language))
                }
            }
            .navigationBarTitleDisplayMode(.inline)
    }

    private var currentScreen: AnyView {
        // Explicit AnyView dispatch (rather than @ViewBuilder + switch)
        // sidesteps a Swift 6.2 frontend crash on x86_64 CI builds where
        // the type-checker for result-builder bodies recurses into
        // grossMonthlyIncomeScreen's branched content and crashes.
        switch viewModel.step {
        case .earningPresence:    return AnyView(earningPresenceScreen)
        case .grossMonthlyIncome: return AnyView(grossMonthlyIncomeContent)
        case .employerDetail:     return AnyView(employerDetailScreen)
        case .incomeVariability:  return AnyView(incomeVariabilityScreen)
        case .unearnedIncome:     return AnyView(unearnedIncomeScreen)
        case .liquidResources:    return AnyView(liquidResourcesScreen)
        case .recentJobLoss:      return AnyView(recentJobLossScreen)
        }
    }

    // MARK: - Screen 1: anyone earning?

    private var earningPresenceScreen: some View {
        triScreen(
            step: .earningPresence,
            title: SNAPIncomeStrings.earningTitle.value(in: language),
            helper: SNAPIncomeStrings.earningHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.anyoneEarning },
                set: { viewModel.answers.anyoneEarning = $0 }
            )
        )
    }

    // MARK: - Screen 2: gross monthly income

    /// Builds screen 2 with explicit AnyView returns. Using an explicit
    /// return form (vs @ViewBuilder + if/else) sidesteps a Swift 6.2
    /// swift-frontend crash on x86_64 in Xcode 26 CI builds.
    private var grossMonthlyIncomeContent: AnyView {
        if let derivation = viewModel.activeSuggestion {
            return AnyView(paystubSuggestionScreen(derivation: derivation))
        }
        return AnyView(manualGrossIncomeScreen)
    }

    private var manualGrossIncomeScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .grossMonthlyIncome),
            title: SNAPIncomeStrings.grossTitle.value(in: language),
            helper: SNAPIncomeStrings.grossHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            grossIncomeAffordance
        }
    }

    private func paystubSuggestionScreen(derivation: SNAPPaystubDerivation) -> some View {
        CivicaQuestionScreen(
            progress: progress(for: .grossMonthlyIncome),
            title: SNAPIncomeStrings.paystubSuggestionTitle.value(in: language),
            helper: SNAPIncomeStrings.paystubSuggestionHelper.value(in: language),
            primaryActionTitle: SNAPIncomeStrings.paystubUseThis.value(in: language),
            primaryActionEnabled: true,
            onPrimary: { viewModel.applyPaystubSuggestion() },
            language: language
        ) {
            paystubSuggestionCard(derivation: derivation)
        }
    }

    private func paystubSuggestionCard(derivation: SNAPPaystubDerivation) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPIncomeStrings.paystubReadLabel.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                Text(SNAPIncomeStrings.paystubReadLine(derivation: derivation, language: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.ink)
            }
            Divider()
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(SNAPIncomeStrings.paystubMonthlyLabel.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                Text(SNAPIncomeStrings.paystubMonthlyLine(derivation: derivation, language: language))
                    .font(CivicaTypography.currencyHero)
                    .foregroundStyle(CivicaColors.ink)
            }
            Button {
                viewModel.switchToManualEntry()
            } label: {
                Text(SNAPIncomeStrings.paystubEnterDifferent.value(in: language))
                    .font(CivicaTypography.footnote.weight(.semibold))
                    .foregroundStyle(CivicaColors.pinePrimary)
            }
            .buttonStyle(.plain)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var grossIncomeAffordance: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Text("$")
                    .font(CivicaTypography.currencyHero)
                    .foregroundStyle(CivicaColors.graphite)
                CivicaCurrencyField(
                    text: $viewModel.grossIncomeField,
                    placeholder: SNAPIncomeStrings.grossPlaceholder.value(in: language),
                    font: CivicaTypography.currencyHero
                )
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 72)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            Text(SNAPIncomeStrings.grossSuffix.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    // MARK: - Screen 2b: employer detail (Wave 1 — BenefitsCal ABEIC)
    //
    // Branched on anyoneEarning == .yes. All fields optional so an
    // applicant who doesn't know their employer's address can still
    // advance — the assister fills the gaps on BenefitsCal directly.
    // For applicants who DO know the details, this is the per-job
    // autofill content the extension writes into the state's
    // employer/address/phone fields.

    private var employerDetailScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .employerDetail),
            title: SNAPIncomeStrings.employerTitle.value(in: language),
            helper: SNAPIncomeStrings.employerHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            employerDetailAffordance
        }
    }

    private var employerDetailAffordance: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            labeledTextField(
                label: SNAPIncomeStrings.employerNameLabel.value(in: language),
                placeholder: SNAPIncomeStrings.employerNamePlaceholder.value(in: language),
                text: Binding(
                    get: { viewModel.answers.employerName },
                    set: { viewModel.answers.employerName = $0 }
                ),
                keyboard: .default
            )
            labeledTextField(
                label: SNAPIncomeStrings.employerStreetLabel.value(in: language),
                placeholder: SNAPIncomeStrings.employerStreetPlaceholder.value(in: language),
                text: Binding(
                    get: { viewModel.answers.employerStreet },
                    set: { viewModel.answers.employerStreet = $0 }
                ),
                keyboard: .default
            )
            HStack(spacing: CivicaSpacing.sm) {
                labeledTextField(
                    label: SNAPIncomeStrings.employerCityLabel.value(in: language),
                    placeholder: SNAPIncomeStrings.employerCityPlaceholder.value(in: language),
                    text: Binding(
                        get: { viewModel.answers.employerCity },
                        set: { viewModel.answers.employerCity = $0 }
                    ),
                    keyboard: .default
                )
                labeledTextField(
                    label: SNAPIncomeStrings.employerStateLabel.value(in: language),
                    placeholder: "CA",
                    text: Binding(
                        get: { viewModel.answers.employerState },
                        set: { viewModel.answers.employerState = String($0.uppercased().prefix(2)) }
                    ),
                    keyboard: .default
                )
                .frame(width: 80)
                labeledTextField(
                    label: SNAPIncomeStrings.employerZIPLabel.value(in: language),
                    placeholder: "94110",
                    text: Binding(
                        get: { viewModel.answers.employerZIP },
                        set: { viewModel.answers.employerZIP = String($0.filter(\.isNumber).prefix(5)) }
                    ),
                    keyboard: .numberPad
                )
                .frame(width: 110)
            }
            labeledTextField(
                label: SNAPIncomeStrings.employerPhoneLabel.value(in: language),
                placeholder: "555-555-5555",
                text: Binding(
                    get: { viewModel.answers.employerPhone },
                    set: { viewModel.answers.employerPhone = $0 }
                ),
                keyboard: .phonePad
            )
            Text(SNAPIncomeStrings.employerOptionalNote.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, CivicaSpacing.xs)
        }
    }

    private func labeledTextField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        keyboard: UIKeyboardType
    ) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(label)
                .font(CivicaTypography.captionStrong)
                .foregroundStyle(CivicaColors.graphite)
            TextField(placeholder, text: text)
                .font(CivicaTypography.body)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .default ? .words : .never)
                .padding(.horizontal, CivicaSpacing.md)
                .padding(.vertical, CivicaSpacing.sm)
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.control)
                        .strokeBorder(CivicaColors.hairline, lineWidth: 1)
                )
        }
    }

    // MARK: - Screen 3: variability

    private var incomeVariabilityScreen: some View {
        triScreen(
            step: .incomeVariability,
            title: SNAPIncomeStrings.variabilityTitle.value(in: language),
            helper: SNAPIncomeStrings.variabilityHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.incomeChangesMonthToMonth },
                set: { viewModel.answers.incomeChangesMonthToMonth = $0 }
            )
        )
    }

    // MARK: - Screen 4: unearned income

    private var unearnedIncomeScreen: some View {
        triScreen(
            step: .unearnedIncome,
            title: SNAPIncomeStrings.unearnedTitle.value(in: language),
            helper: SNAPIncomeStrings.unearnedHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.hasUnearnedIncome },
                set: { viewModel.answers.hasUnearnedIncome = $0 }
            )
        )
    }

    // MARK: - Screen 5: liquid resources

    private var liquidResourcesScreen: some View {
        CivicaQuestionScreen(
            progress: progress(for: .liquidResources),
            title: SNAPIncomeStrings.liquidResourcesTitle.value(in: language),
            helper: SNAPIncomeStrings.liquidResourcesHelper.value(in: language),
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: viewModel.canAdvanceFromCurrentStep,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            liquidResourcesAffordance
        }
    }

    private var liquidResourcesAffordance: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Text("$")
                    .font(CivicaTypography.currencyHero)
                    .foregroundStyle(CivicaColors.graphite)
                CivicaCurrencyField(
                    text: $viewModel.liquidResourcesField,
                    placeholder: SNAPIncomeStrings.liquidResourcesPlaceholder.value(in: language),
                    font: CivicaTypography.currencyHero
                )
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.vertical, CivicaSpacing.md)
            .frame(minHeight: 72)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.control)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            Text(SNAPIncomeStrings.liquidResourcesSuffix.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
            // Wave D — bank-statement scan to pre-fill liquid
            // resources. Hidden on devices without on-device
            // extraction available.
            SNAPInlineDocScanCTA(
                documentType: .bankStatement,
                ctaLabel: SNAPIncomeStrings.scanBankCTA.value(in: language),
                onExtracted: { result in
                    if let amount = result.primaryAmount, !amount.isEmpty {
                        viewModel.liquidResourcesField = amount
                        viewModel.liquidResourcesPrefilledFromScan = true
                    }
                }
            )
            if viewModel.liquidResourcesPrefilledFromScan {
                Text(SNAPIncomeStrings.scanBankPrefilledNote.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Screen 6: recent job loss

    private var recentJobLossScreen: some View {
        triScreen(
            step: .recentJobLoss,
            title: SNAPIncomeStrings.recentJobLossTitle.value(in: language),
            helper: SNAPIncomeStrings.recentJobLossHelper.value(in: language),
            value: Binding(
                get: { viewModel.answers.recentJobLoss30d },
                set: { viewModel.answers.recentJobLoss30d = $0 }
            )
        )
    }

    // MARK: - Shared 3-way affordance

    private func triScreen(
        step: SNAPIncomeFlowViewModel.Step,
        title: String,
        helper: String,
        value: Binding<SNAPIncomeAnswers.Tri?>
    ) -> some View {
        let options: [SNAPIncomeAnswers.Tri] = [.yes, .no, .notSure]
        return CivicaQuestionScreen(
            progress: progress(for: step),
            title: title,
            helper: helper,
            primaryActionTitle: CivicaQuestionStrings.continueLabel.value(in: language),
            primaryActionEnabled: value.wrappedValue != nil,
            onPrimary: advanceOrComplete,
            language: language
        ) {
            CivicaQuestionChoices(
                options: options.map { SNAPIncomeStrings.triLabel(for: $0, language: language) },
                selection: Binding(
                    get: {
                        value.wrappedValue.map { SNAPIncomeStrings.triLabel(for: $0, language: language) }
                    },
                    set: { label in
                        value.wrappedValue = options.first { tri in
                            SNAPIncomeStrings.triLabel(for: tri, language: language) == label
                        }
                    }
                )
            )
        }
    }

    // MARK: - Helpers

    private func progress(for step: SNAPIncomeFlowViewModel.Step)
        -> CivicaQuestionScreenProgress
    {
        .init(
            current: step.oneBasedIndex,
            total: SNAPIncomeFlowViewModel.Step.total,
            sectionIndex: SNAPApplicationSection.income.oneBasedIndex,
            sectionCount: SNAPApplicationSection.count,
            sectionTitle: SNAPApplicationSection.income.title(in: language)
        )
    }

    private func advanceOrComplete() {
        civicaWithAnimation(.easeInOut(duration: 0.18)) {
            if viewModel.step == .grossMonthlyIncome {
                viewModel.recordGrossIncomeField()
            }
            if viewModel.step == .liquidResources {
                viewModel.recordLiquidResourcesField()
            }
            if viewModel.isAtLastStep {
                onComplete(viewModel.answers)
            } else {
                viewModel.advance()
            }
        }
    }
}

// MARK: - Strings

enum SNAPIncomeStrings {

    // 3-way option labels — shared across all four screens.
    static func triLabel(for value: SNAPIncomeAnswers.Tri, language: CivicaLanguage) -> String {
        switch (value, language) {
        case (.yes, .english): return "Yes"
        case (.yes, .spanish): return "Sí"
        case (.no, .english):  return "No"
        case (.no, .spanish):  return "No"
        case (.notSure, .english): return "I'm not sure"
        case (.notSure, .spanish): return "No estoy seguro"
        }
    }

    // Screen 1
    static let earningTitle = CivicaText(
        "Is anyone in your household earning money right now?",
        es: "¿Alguien en tu hogar está ganando dinero ahora mismo?"
    )
    static let earningHelper = CivicaText(
        "Count any job — full-time, part-time, gig work, side jobs, self-employment. We'll ask for amounts next.",
        es: "Cuenta cualquier trabajo — tiempo completo, medio tiempo, trabajo por encargo, trabajos secundarios, por cuenta propia. Preguntaremos los montos después."
    )

    // Screen 2
    static let grossTitle = CivicaText(
        "About how much does the whole household bring in each month, before taxes?",
        es: "¿Cuánto trae el hogar entero cada mes, antes de impuestos?"
    )
    static let grossHelper = CivicaText(
        "An estimate is fine. SNAP looks at gross income — what you make before taxes and deductions.",
        es: "Una estimación está bien. SNAP mira los ingresos brutos — lo que ganas antes de impuestos y deducciones."
    )
    /// Word placeholder ("Amount" / "Cantidad") rather than "0" so the
    /// empty state is unambiguous — see CivicaQuestionStrings for the
    /// shared rationale.
    static let grossPlaceholder = CivicaQuestionStrings.amountPlaceholder
    // Wave 1 — employer detail strings (branched on anyoneEarning == .yes)

    static let employerTitle = CivicaText(
        "Tell us about your employer",
        es: "Cuéntanos sobre tu empleador"
    )
    static let employerHelper = CivicaText(
        "These details speed up the county's verification step. Skip anything you don't know — the assister can fill it in later.",
        es: "Estos datos aceleran la verificación del condado. Omite lo que no sepas — el asistente puede completarlo después."
    )
    static let employerNameLabel = CivicaText(
        "Employer name",
        es: "Nombre del empleador"
    )
    static let employerNamePlaceholder = CivicaText(
        "Acme Corp",
        es: "Empresa Acme"
    )
    static let employerStreetLabel = CivicaText(
        "Employer address",
        es: "Dirección del empleador"
    )
    static let employerStreetPlaceholder = CivicaText(
        "123 Main St",
        es: "Calle Principal 123"
    )
    static let employerCityLabel = CivicaText(
        "City",
        es: "Ciudad"
    )
    static let employerCityPlaceholder = CivicaText(
        "San Francisco",
        es: "San Francisco"
    )
    static let employerStateLabel = CivicaText(
        "State",
        es: "Estado"
    )
    static let employerZIPLabel = CivicaText(
        "ZIP",
        es: "Código postal"
    )
    static let employerPhoneLabel = CivicaText(
        "Employer phone",
        es: "Teléfono del empleador"
    )
    static let employerOptionalNote = CivicaText(
        "All fields here are optional. Blanks become \"human must fill\" hints to the assister.",
        es: "Todos los campos aquí son opcionales. Los espacios en blanco se convierten en notas de \"completar manualmente\" para el asistente."
    )

    // Wave D — bank-statement-scan affordance strings
    static let scanBankCTA = CivicaText(
        "Scan a bank statement to autofill",
        es: "Escanea un estado bancario para autollenar"
    )
    static let scanBankPrefilledNote = CivicaText(
        "Pre-filled from your statement — change above if needed.",
        es: "Pre-llenado desde tu estado bancario — cámbialo arriba si es necesario."
    )

    static let grossSuffix = CivicaText(
        "Total monthly, before taxes",
        es: "Total mensual, antes de impuestos"
    )

    // Screen 3
    static let variabilityTitle = CivicaText(
        "Does that amount change month to month?",
        es: "¿Esa cantidad cambia mes a mes?"
    )
    static let variabilityHelper = CivicaText(
        "Yes if hours, tips, or seasonal work make it different each month. SNAP averages variable income across recent months.",
        es: "Sí si las horas, propinas o trabajo de temporada lo hacen diferente cada mes. SNAP promedia los ingresos variables en los últimos meses."
    )

    // Screen 4
    static let unearnedTitle = CivicaText(
        "Does anyone get income that's not from a job?",
        es: "¿Alguien recibe ingresos que no son de un trabajo?"
    )
    static let unearnedHelper = CivicaText(
        "Things like SSI, Social Security, unemployment, child support, pension, or veterans benefits. These count for SNAP too.",
        es: "Cosas como SSI, Seguro Social, desempleo, manutención de hijos, pensión o beneficios para veteranos. Estos también cuentan para SNAP."
    )

    // Screen 5 — liquid resources (cash on hand + bank balances).
    // SNAP uses this together with gross income for the very-low-income
    // expedited test (7 CFR 273.2(i)(1)(i)) and the housing-exceeds-
    // resources test (7 CFR 273.2(i)(1)(iii)).
    static let liquidResourcesTitle = CivicaText(
        "How much cash do you have on hand and in checking or savings, total?",
        es: "¿Cuánto efectivo tienes a mano y en cuentas de cheques o ahorros, en total?"
    )
    static let liquidResourcesHelper = CivicaText(
        "Add up cash, checking, and savings across the household. Leave it at 0 if you don't have any. Retirement accounts and your home don't count.",
        es: "Suma el efectivo, las cuentas de cheques y ahorros del hogar. Déjalo en 0 si no tienes nada. Las cuentas de jubilación y tu casa no cuentan."
    )
    static let liquidResourcesPlaceholder = CivicaText("0", es: "0")
    static let liquidResourcesSuffix = CivicaText(
        "Cash + checking + savings",
        es: "Efectivo + cheques + ahorros"
    )

    // Screen 2 — paystub-derived prefill variant. Shown only when the
    // user confirmed a paystub in the documents-checklist flow and
    // hasn't already entered a gross-monthly amount.
    static let paystubSuggestionTitle = CivicaText(
        "We found this on your paystub.",
        es: "Encontramos esto en tu recibo de pago."
    )
    static let paystubSuggestionHelper = CivicaText(
        "Tap Use this if it looks right. SNAP looks at gross income — what you make before taxes and deductions.",
        es: "Toca Usar esto si se ve bien. SNAP mira los ingresos brutos — lo que ganas antes de impuestos y deducciones."
    )
    static let paystubReadLabel = CivicaText("From your paystub", es: "De tu recibo")
    static let paystubMonthlyLabel = CivicaText(
        "Estimated gross monthly",
        es: "Estimación mensual bruta"
    )
    static let paystubUseThis = CivicaText("Use this", es: "Usar esto")
    static let paystubEnterDifferent = CivicaText(
        "Enter a different amount",
        es: "Ingresar una cantidad diferente"
    )

    /// "$1,800 every 2 weeks" — combines the per-period gross with a
    /// human-readable frequency label.
    static func paystubReadLine(
        derivation: SNAPPaystubDerivation,
        language: CivicaLanguage
    ) -> String {
        let amount = formatCurrency(derivation.perPeriodGross)
        let freq = frequencyShortLabel(derivation.frequency, language: language)
        return "\(amount) \(freq)"
    }

    /// "≈ $3,900/month" — what the income flow is about to record.
    static func paystubMonthlyLine(
        derivation: SNAPPaystubDerivation,
        language: CivicaLanguage
    ) -> String {
        let amount = formatCurrency(derivation.monthlyEarnedIncome)
        switch language {
        case .english: return "≈ \(amount)/month"
        case .spanish: return "≈ \(amount)/mes"
        }
    }

    private static func frequencyShortLabel(
        _ frequency: SNAPPaystubFrequency,
        language: CivicaLanguage
    ) -> String {
        switch (frequency, language) {
        case (.weekly, .english):       return "every week"
        case (.weekly, .spanish):       return "cada semana"
        case (.biweekly, .english):     return "every 2 weeks"
        case (.biweekly, .spanish):     return "cada 2 semanas"
        case (.semimonthly, .english):  return "twice a month"
        case (.semimonthly, .spanish):  return "dos veces al mes"
        case (.monthly, .english):      return "every month"
        case (.monthly, .spanish):      return "cada mes"
        }
    }

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        f.maximumFractionDigits = 0
        return f
    }()

    private static func formatCurrency(_ amount: Decimal) -> String {
        let rounded = NSDecimalNumber(decimal: amount)
        return currencyFormatter.string(from: rounded) ?? "$\(rounded.intValue)"
    }

    // Screen 6 — recent job loss (last 30 days). Soft signal for the
    // expedited classifier; not a regulatory input on its own.
    static let recentJobLossTitle = CivicaText(
        "Has anyone in the household lost a job in the last 30 days?",
        es: "¿Alguien en el hogar perdió un trabajo en los últimos 30 días?"
    )
    static let recentJobLossHelper = CivicaText(
        "Yes if a job ended, was laid off, or hours were cut to zero — even if you're getting unemployment.",
        es: "Sí si un trabajo terminó, hubo despidos o las horas se redujeron a cero — incluso si está recibiendo desempleo."
    )
}

#if DEBUG
struct SNAPIncomeFlowView_Previews: PreviewProvider {
    @MainActor static var previews: some View {
        NavigationStack {
            SNAPIncomeFlowView(
                viewModel: SNAPIncomeFlowViewModel(),
            language: .english,
                onComplete: { _ in },
                onExit: {}
            )
        }
    }
}
#endif
